import { html } from "lit";
import { getSafeLocalStorage } from "../../../local-storage.ts";
import { icons } from "../../icons.ts";
import {
  isTtsSupported,
  speakText,
  stopTts,
  isTtsSpeaking,
} from "../speech.ts";
import { extractTextCached } from "../message-extract.ts";
import type { MessageGroup } from "../../types/chat-types.ts";

const SKIP_DELETE_CONFIRM_KEY = "openclaw:skipDeleteConfirm";

type DeleteConfirmSide = "left" | "right";

function shouldSkipDeleteConfirm(): boolean {
  try {
    return getSafeLocalStorage()?.getItem(SKIP_DELETE_CONFIRM_KEY) === "1";
  } catch {
    return false;
  }
}

function extractGroupText(group: MessageGroup): string {
  const parts: string[] = [];
  for (const { message } of group.messages) {
    const text = extractTextCached(message);
    if (text?.trim()) {
      parts.push(text.trim());
    }
  }
  return parts.join("\n\n");
}

export function renderDeleteButton(
  onDelete: () => void,
  side: DeleteConfirmSide,
) {
  return html`
    <span class="chat-delete-wrap">
      <button
        class="chat-group-delete"
        title="Delete"
        aria-label="Delete message"
        @click=${(e: Event) => {
          if (shouldSkipDeleteConfirm()) {
            onDelete();
            return;
          }
          const btn = e.currentTarget as HTMLElement;
          const wrap = btn.closest(".chat-delete-wrap") as HTMLElement;
          const existing = wrap?.querySelector(".chat-delete-confirm");
          if (existing) {
            existing.remove();
            return;
          }
          const popover = document.createElement("div");
          popover.className = `chat-delete-confirm chat-delete-confirm--${side}`;
          popover.innerHTML = `
            <p class="chat-delete-confirm__text">Delete this message?</p>
            <label class="chat-delete-confirm__remember">
              <input type="checkbox" class="chat-delete-confirm__check" />
              <span>Don't ask again</span>
            </label>
            <div class="chat-delete-confirm__actions">
              <button class="chat-delete-confirm__cancel" type="button">Cancel</button>
              <button class="chat-delete-confirm__yes" type="button">Delete</button>
            </div>
          `;
          wrap.appendChild(popover);

          const cancel = popover.querySelector(".chat-delete-confirm__cancel")!;
          const yes = popover.querySelector(".chat-delete-confirm__yes")!;
          const check = popover.querySelector(
            ".chat-delete-confirm__check",
          ) as HTMLInputElement;

          cancel.addEventListener("click", () => popover.remove());
          yes.addEventListener("click", () => {
            if (check.checked) {
              try {
                getSafeLocalStorage()?.setItem(SKIP_DELETE_CONFIRM_KEY, "1");
              } catch {}
            }
            popover.remove();
            onDelete();
          });

          const closeOnOutside = (evt: MouseEvent) => {
            if (!popover.contains(evt.target as Node) && evt.target !== btn) {
              popover.remove();
              document.removeEventListener("click", closeOnOutside, true);
            }
          };
          requestAnimationFrame(() =>
            document.addEventListener("click", closeOnOutside, true),
          );
        }}
      >
        ${icons.trash ?? icons.x}
      </button>
    </span>
  `;
}

export function renderTtsButton(group: MessageGroup) {
  return html`
    <button
      class="btn btn--xs chat-tts-btn"
      type="button"
      title=${isTtsSpeaking() ? "Stop speaking" : "Read aloud"}
      aria-label=${isTtsSpeaking() ? "Stop speaking" : "Read aloud"}
      @click=${(e: Event) => {
        const btn = e.currentTarget as HTMLButtonElement;
        if (isTtsSpeaking()) {
          stopTts();
          btn.classList.remove("chat-tts-btn--active");
          btn.title = "Read aloud";
          return;
        }
        const text = extractGroupText(group);
        if (!text) {
          return;
        }
        btn.classList.add("chat-tts-btn--active");
        btn.title = "Stop speaking";
        speakText(text, {
          onEnd: () => {
            if (btn.isConnected) {
              btn.classList.remove("chat-tts-btn--active");
              btn.title = "Read aloud";
            }
          },
          onError: () => {
            if (btn.isConnected) {
              btn.classList.remove("chat-tts-btn--active");
              btn.title = "Read aloud";
            }
          },
        });
      }}
    >
      ${icons.volume2}
    </button>
  `;
}
