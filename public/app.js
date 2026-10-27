const turnsEl = document.querySelector("#turns");
const transcript = document.querySelector("#transcript");
const form = document.querySelector("#composer");
const input = document.querySelector("#message");
const sendButton = document.querySelector("#send");
const clearButton = document.querySelector("#clear-chat");
const chipRow = document.querySelector("#chips");

const STORAGE_KEY = "water-usage-chat";

let messages = [];
let pending = false;
let requestId = 0;

function loadMessages() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
    );
  } catch {
    return [];
  }
}

function saveMessages() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

function scrollToEnd() {
  transcript.scrollTop = transcript.scrollHeight;
}

function addBubble(role, content, extraClass) {
  const article = document.createElement("article");
  article.className = `bubble ${role === "user" ? "user" : "bot"}${
    extraClass ? ` ${extraClass}` : ""
  }`;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = role === "user" ? "You" : "Water guide";
  const paragraph = document.createElement("p");
  paragraph.textContent = content;
  article.append(who, paragraph);
  turnsEl.append(article);
  scrollToEnd();
  return article;
}

function renderSaved() {
  turnsEl.replaceChildren();
  for (const message of messages) {
    addBubble(message.role, message.content);
  }
  scrollToEnd();
}

function updateSendState() {
  sendButton.disabled = pending || !input.value.trim();
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

function setPending(isPending) {
  pending = isPending;
  input.disabled = false;
  clearButton.disabled = isPending;
  chipRow.querySelectorAll("button").forEach((button) => {
    button.disabled = isPending;
  });
  sendButton.textContent = isPending ? "Sending…" : "Send";
  transcript.setAttribute("aria-busy", isPending ? "true" : "false");
  updateSendState();
}

async function sendMessage(text) {
  const content = text.trim();
  if (!content || pending) return;

  const id = ++requestId;
  messages.push({ role: "user", content });
  saveMessages();
  addBubble("user", content);
  input.value = "";
  resizeInput();
  setPending(true);

  const thinking = addBubble("assistant", "Thinking…", "thinking");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
      signal: AbortSignal.timeout(35000),
    });
    const data = await response.json().catch(() => ({}));
    if (id !== requestId) return;
    thinking.remove();

    if (!response.ok) {
      const errorText =
        typeof data.error === "string" && data.error.trim()
          ? data.error.trim()
          : "The chatbot could not answer just now. Please try again.";
      addBubble("assistant", errorText, "error");
      return;
    }

    const reply = typeof data.reply === "string" ? data.reply.trim() : "";
    if (!reply) {
      addBubble(
        "assistant",
        "The chatbot could not answer just now. Please try again.",
        "error"
      );
      return;
    }

    messages.push({ role: "assistant", content: reply });
    saveMessages();
    addBubble("assistant", reply);
  } catch {
    if (id !== requestId) return;
    thinking.remove();
    addBubble(
      "assistant",
      "Could not reach the chatbot. Check the connection and try again.",
      "error"
    );
  } finally {
    if (id === requestId) setPending(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", () => {
  resizeInput();
  updateSendState();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});

chipRow.addEventListener("click", (event) => {
  const chip = event.target.closest("button[data-prompt]");
  if (!chip) return;
  sendMessage(chip.dataset.prompt);
});

clearButton.addEventListener("click", () => {
  requestId += 1;
  messages = [];
  saveMessages();
  turnsEl.replaceChildren();
  input.value = "";
  resizeInput();
  setPending(false);
  input.focus();
});

messages = loadMessages();
renderSaved();
updateSendState();
