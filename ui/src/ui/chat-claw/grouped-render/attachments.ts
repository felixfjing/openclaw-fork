import { html, nothing } from "lit";
import { openExternalUrlSafe } from "../../open-external-url.ts";
import { icons } from "../../icons.ts";
import type { MessageContentItem } from "../../types/chat-types.ts";

type AssistantAttachmentAvailability =
  | { status: "checking" }
  | { status: "available" }
  | { status: "unavailable"; reason: string; checkedAt: number };

const assistantAttachmentAvailabilityCache = new Map<
  string,
  AssistantAttachmentAvailability
>();
const ASSISTANT_ATTACHMENT_UNAVAILABLE_RETRY_MS = 5_000;

export function resetAssistantAttachmentAvailabilityCacheForTest() {
  assistantAttachmentAvailabilityCache.clear();
}

type ImageBlock = {
  url: string;
  alt?: string;
};

export function extractImages(message: unknown): ImageBlock[] {
  const m = message as Record<string, unknown>;
  const content = m.content;
  const images: ImageBlock[] = [];

  if (Array.isArray(content)) {
    for (const block of content) {
      if (typeof block !== "object" || block === null) {
        continue;
      }
      const b = block as Record<string, unknown>;

      if (b.type === "image") {
        const source = b.source as Record<string, unknown> | undefined;
        if (source?.type === "base64" && typeof source.data === "string") {
          const data = source.data;
          const mediaType = (source.media_type as string) || "image/png";
          const url = data.startsWith("data:")
            ? data
            : `data:${mediaType};base64,${data}`;
          images.push({ url });
        } else if (typeof b.url === "string") {
          images.push({ url: b.url });
        }
      } else if (b.type === "image_url") {
        const imageUrl = b.image_url as Record<string, unknown> | undefined;
        if (typeof imageUrl?.url === "string") {
          images.push({ url: imageUrl.url });
        }
      }
    }
  }

  return images;
}

function isLocalAssistantAttachmentSource(source: string): boolean {
  const trimmed = source.trim();
  if (/^\/(?:__openclaw__|media)\//.test(trimmed)) {
    return false;
  }
  return (
    trimmed.startsWith("file://") ||
    trimmed.startsWith("~") ||
    trimmed.startsWith("/") ||
    /^[a-zA-Z]:[\\/]/.test(trimmed)
  );
}

function normalizeLocalAttachmentPath(source: string): string | null {
  const trimmed = source.trim();
  if (!isLocalAssistantAttachmentSource(trimmed)) {
    return null;
  }
  if (trimmed.startsWith("file://")) {
    try {
      const url = new URL(trimmed);
      const pathname = decodeURIComponent(url.pathname);
      if (/^\/[a-zA-Z]:\//.test(pathname)) {
        return pathname.slice(1);
      }
      return pathname;
    } catch {
      return null;
    }
  }
  if (trimmed.startsWith("~")) {
    return null;
  }
  return trimmed;
}

function resolveHomeCandidatesFromRoots(
  localMediaPreviewRoots: readonly string[],
): string[] {
  const candidates = new Set<string>();
  for (const root of localMediaPreviewRoots) {
    const normalized = canonicalizeLocalPathForComparison(root.trim());
    const unixHome = normalized.match(
      /^(\/Users\/[^/]+|\/home\/[^/]+)(?:\/|$)/,
    );
    if (unixHome?.[1]) {
      candidates.add(unixHome[1]);
      continue;
    }
    const windowsHome = normalized.match(/^([a-z]:\/Users\/[^/]+)(?:\/|$)/i);
    if (windowsHome?.[1]) {
      candidates.add(windowsHome[1]);
    }
  }
  return [...candidates];
}

function canonicalizeLocalPathForComparison(value: string): string {
  let slashNormalized = value.replace(/\\/g, "/").replace(/\/+$/, "");
  if (/^\/[a-zA-Z]:\//.test(slashNormalized)) {
    slashNormalized = slashNormalized.slice(1);
  }
  if (/^[a-zA-Z]:\//.test(slashNormalized)) {
    return slashNormalized.toLowerCase();
  }
  return slashNormalized;
}

function isLocalAttachmentPreviewAllowed(
  source: string,
  localMediaPreviewRoots: readonly string[],
): boolean {
  const normalizedSource = normalizeLocalAttachmentPath(source);
  const comparableSources = normalizedSource
    ? [canonicalizeLocalPathForComparison(normalizedSource)]
    : source.trim().startsWith("~")
      ? resolveHomeCandidatesFromRoots(localMediaPreviewRoots).map((home) =>
          canonicalizeLocalPathForComparison(
            source.trim().replace(/^~(?=$|[\\/])/, home),
          ),
        )
      : [];
  if (comparableSources.length === 0) {
    return false;
  }
  return localMediaPreviewRoots.some((root) => {
    const normalizedRoot = canonicalizeLocalPathForComparison(root.trim());
    return (
      normalizedRoot.length > 0 &&
      comparableSources.some(
        (comparableSource) =>
          comparableSource === normalizedRoot ||
          comparableSource.startsWith(`${normalizedRoot}/`),
      )
    );
  });
}

function buildAssistantAttachmentUrl(
  source: string,
  basePath?: string,
  authToken?: string | null,
): string {
  if (!isLocalAssistantAttachmentSource(source)) {
    return source;
  }
  const normalizedBasePath =
    basePath && basePath !== "/"
      ? basePath.endsWith("/")
        ? basePath.slice(0, -1)
        : basePath
      : "";
  const params = new URLSearchParams({ source });
  const normalizedToken = authToken?.trim();
  if (normalizedToken) {
    params.set("token", normalizedToken);
  }
  return `${normalizedBasePath}/__openclaw__/assistant-media?${params.toString()}`;
}

function buildAssistantAttachmentMetaUrl(
  source: string,
  basePath?: string,
  authToken?: string | null,
): string {
  const attachmentUrl = buildAssistantAttachmentUrl(
    source,
    basePath,
    authToken,
  );
  return `${attachmentUrl}${attachmentUrl.includes("?") ? "&" : "?"}meta=1`;
}

function resolveAssistantAttachmentAvailability(
  source: string,
  localMediaPreviewRoots: readonly string[],
  basePath: string | undefined,
  authToken: string | null | undefined,
  onRequestUpdate: (() => void) | undefined,
): AssistantAttachmentAvailability {
  if (!isLocalAssistantAttachmentSource(source)) {
    return { status: "available" };
  }
  if (!isLocalAttachmentPreviewAllowed(source, localMediaPreviewRoots)) {
    return {
      status: "unavailable",
      reason: "Outside allowed folders",
      checkedAt: Date.now(),
    };
  }
  const normalizedAuthToken = authToken?.trim() ?? "";
  const cacheKey = `${basePath ?? ""}::${normalizedAuthToken}::${source}`;
  const cached = assistantAttachmentAvailabilityCache.get(cacheKey);
  if (cached) {
    if (
      cached.status === "unavailable" &&
      Date.now() - cached.checkedAt >= ASSISTANT_ATTACHMENT_UNAVAILABLE_RETRY_MS
    ) {
      assistantAttachmentAvailabilityCache.delete(cacheKey);
    } else {
      return cached;
    }
  }
  assistantAttachmentAvailabilityCache.set(cacheKey, { status: "checking" });
  if (typeof fetch === "function") {
    void fetch(buildAssistantAttachmentMetaUrl(source, basePath, authToken), {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as {
          available?: boolean;
          reason?: string;
        } | null;
        if (payload?.available === true) {
          assistantAttachmentAvailabilityCache.set(cacheKey, {
            status: "available",
          });
        } else {
          assistantAttachmentAvailabilityCache.set(cacheKey, {
            status: "unavailable",
            reason: payload?.reason?.trim() || "Attachment unavailable",
            checkedAt: Date.now(),
          });
        }
      })
      .catch(() => {
        assistantAttachmentAvailabilityCache.set(cacheKey, {
          status: "unavailable",
          reason: "Attachment unavailable",
          checkedAt: Date.now(),
        });
      })
      .finally(() => {
        onRequestUpdate?.();
      });
  }
  return { status: "checking" };
}

function renderAssistantAttachmentStatusCard(params: {
  kind: "image" | "audio" | "video" | "document";
  label: string;
  badge: string;
  reason?: string;
}) {
  const icon =
    params.kind === "image"
      ? icons.image
      : params.kind === "audio"
        ? icons.mic
        : params.kind === "video"
          ? icons.monitor
          : icons.paperclip;
  return html`
    <div
      class="chat-assistant-attachment-card chat-assistant-attachment-card--blocked"
    >
      <div class="chat-assistant-attachment-card__header">
        <span class="chat-assistant-attachment-card__icon">${icon}</span>
        <span class="chat-assistant-attachment-card__title"
          >${params.label}</span
        >
        <span
          class="chat-assistant-attachment-badge chat-assistant-attachment-badge--muted"
          >${params.badge}</span
        >
      </div>
      ${params.reason
        ? html`<div class="chat-assistant-attachment-card__reason">
            ${params.reason}
          </div>`
        : nothing}
    </div>
  `;
}

export function renderMessageImages(images: ImageBlock[]) {
  if (images.length === 0) {
    return nothing;
  }

  const openImage = (url: string) => {
    openExternalUrlSafe(url, { allowDataImage: true });
  };

  return html`
    <div class="chat-message-images">
      ${images.map(
        (img) => html`
          <img
            src=${img.url}
            alt=${img.alt ?? "Attached image"}
            class="chat-message-image"
            @click=${() => openImage(img.url)}
          />
        `,
      )}
    </div>
  `;
}

export function renderAssistantAttachments(
  attachments: Array<Extract<MessageContentItem, { type: "attachment" }>>,
  localMediaPreviewRoots: readonly string[],
  basePath?: string,
  authToken?: string | null,
  onRequestUpdate?: () => void,
) {
  if (attachments.length === 0) {
    return nothing;
  }
  return html`
    <div class="chat-assistant-attachments">
      ${attachments.map(({ attachment }) => {
        const availability = resolveAssistantAttachmentAvailability(
          attachment.url,
          localMediaPreviewRoots,
          basePath,
          authToken,
          onRequestUpdate,
        );
        const attachmentUrl =
          availability.status === "available"
            ? buildAssistantAttachmentUrl(attachment.url, basePath, authToken)
            : null;
        if (attachment.kind === "image") {
          if (!attachmentUrl) {
            return renderAssistantAttachmentStatusCard({
              kind: "image",
              label: attachment.label,
              badge:
                availability.status === "checking"
                  ? "Checking..."
                  : "Unavailable",
              reason:
                availability.status === "unavailable"
                  ? availability.reason
                  : undefined,
            });
          }
          return html`
            <img
              src=${attachmentUrl}
              alt=${attachment.label}
              class="chat-message-image"
              @click=${() =>
                openExternalUrlSafe(attachmentUrl, { allowDataImage: true })}
            />
          `;
        }
        if (attachment.kind === "audio") {
          return html`
            <div
              class="chat-assistant-attachment-card chat-assistant-attachment-card--audio"
            >
              <div class="chat-assistant-attachment-card__header">
                <span class="chat-assistant-attachment-card__title"
                  >${attachment.label}</span
                >
                ${!attachmentUrl
                  ? html`<span
                      class="chat-assistant-attachment-badge chat-assistant-attachment-badge--muted"
                      >${availability.status === "checking"
                        ? "Checking..."
                        : "Unavailable"}</span
                    >`
                  : attachment.isVoiceNote
                    ? html`<span class="chat-assistant-attachment-badge"
                        >Voice note</span
                      >`
                    : nothing}
              </div>
              ${attachmentUrl
                ? html`<audio
                    controls
                    preload="metadata"
                    src=${attachmentUrl}
                  ></audio>`
                : availability.status === "unavailable"
                  ? html`<div class="chat-assistant-attachment-card__reason">
                      ${availability.reason}
                    </div>`
                  : nothing}
            </div>
          `;
        }
        if (attachment.kind === "video") {
          if (!attachmentUrl) {
            return renderAssistantAttachmentStatusCard({
              kind: "video",
              label: attachment.label,
              badge:
                availability.status === "checking"
                  ? "Checking..."
                  : "Unavailable",
              reason:
                availability.status === "unavailable"
                  ? availability.reason
                  : undefined,
            });
          }
          return html`
            <div
              class="chat-assistant-attachment-card chat-assistant-attachment-card--video"
            >
              <video controls preload="metadata" src=${attachmentUrl}></video>
              <a
                class="chat-assistant-attachment-card__link"
                href=${attachmentUrl}
                target="_blank"
                rel="noreferrer"
                >${attachment.label}</a
              >
            </div>
          `;
        }
        if (!attachmentUrl) {
          return renderAssistantAttachmentStatusCard({
            kind: "document",
            label: attachment.label,
            badge:
              availability.status === "checking"
                ? "Checking..."
                : "Unavailable",
            reason:
              availability.status === "unavailable"
                ? availability.reason
                : undefined,
          });
        }
        return html`
          <div class="chat-assistant-attachment-card">
            <span class="chat-assistant-attachment-card__icon"
              >${icons.paperclip}</span
            >
            <a
              class="chat-assistant-attachment-card__link"
              href=${attachmentUrl}
              target="_blank"
              rel="noreferrer"
              >${attachment.label}</a
            >
          </div>
        `;
      })}
    </div>
  `;
}
