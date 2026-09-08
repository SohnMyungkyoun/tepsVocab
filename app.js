const DATA_URL = "vocab.md";
const KNOWN_TAG = "<!-- known -->";
const CHECKPOINT_KEY = "vocab-checkpoint";
const state = { groups: [], groupIndex: 0, wordIndex: 0, revealed: false, known: new Set(JSON.parse(localStorage.getItem("vocab-known") || "[]")) };
const settings = { repo: localStorage.getItem("vocab-repo") || "", token: localStorage.getItem("vocab-token") || "" };

function parseVocab(markdown) {
  return markdown.trim().split(/\n\s*\n/).map((block) => ({
    words: block.split("\n").reduce((words, rawLine) => {
      const line = rawLine.trim();
      if (!line) return words;
      if (line.startsWith("예문:")) {
        if (words.length) words.at(-1).example = line.slice(3).trim();
        return words;
      }
      const known = line.includes(KNOWN_TAG);
      const [word, ...meaning] = line.replace(KNOWN_TAG, "").trim().split(/\s+—\s+/);
      words.push({ word: word.trim(), meaning: meaning.join(" — ").trim(), example: "", known });
      return words;
    }, [])
  })).map((group) => ({
    ...group,
    id: group.words.map((item) => item.word.toLowerCase()).join("|")
  })).filter((group) => group.words.length);
}

function shuffle(items) { return [...items].sort(() => Math.random() - .5); }
// 학습을 시작한 단락은 그 회차가 끝날 때까지 유지한다. 완료 체크는 다음 실행에서만 반영된다.
function currentGroup() { return state.groups[state.groupIndex]; }
function saveKnown() { localStorage.setItem("vocab-known", JSON.stringify([...state.known])); }
function saveCheckpoint() {
  localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({
    groupIds: state.groups.map((group) => group.id),
    groupIndex: state.groupIndex,
    wordIndex: state.wordIndex
  }));
}
function restoreCheckpoint(groups) {
  const checkpoint = JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || "null");
  if (!checkpoint || !Array.isArray(checkpoint.groupIds)) return groups;
  const byId = new Map(groups.map((group) => [group.id, group]));
  const restored = checkpoint.groupIds.map((id) => byId.get(id)).filter(Boolean);
  if (restored.length !== groups.length) { localStorage.removeItem(CHECKPOINT_KEY); return groups; }
  state.groupIndex = Math.min(checkpoint.groupIndex, restored.length - 1);
  state.wordIndex = Math.min(checkpoint.wordIndex, restored[state.groupIndex].words.length - 1);
  return restored;
}

function render() {
  const groups = state.groups;
  const progress = document.querySelector("#progress");
  const study = document.querySelector("#study");
  if (!groups.length) {
    progress.textContent = "모든 단어를 완벽히 알고 있어요.";
    study.innerHTML = '<section class="summary"><h2>완료!</h2><p>새 단어를 <code>vocab.md</code>에 추가하면 다시 시작할 수 있습니다.</p></section>';
    return;
  }
  state.groupIndex = Math.min(state.groupIndex, groups.length - 1);
  const group = groups[state.groupIndex]; state.wordIndex = Math.min(state.wordIndex, group.words.length - 1);
  const item = group.words[state.wordIndex];
  progress.textContent = `단락 ${state.groupIndex + 1} / ${groups.length} · 단어 ${state.wordIndex + 1} / ${group.words.length}`;
  const node = document.querySelector("#word-template").content.cloneNode(true);
  node.querySelector(".card-count").textContent = "뜻을 떠올린 뒤 확인해 보세요";
  node.querySelector(".word").textContent = item.word;
  node.querySelector(".meaning").textContent = item.meaning || "뜻을 vocab.md에 추가해 주세요.";
  node.querySelector(".example p").textContent = item.example ? `“${item.example}”` : "";
  const meaning = node.querySelector(".meaning"), example = node.querySelector(".example"), button = node.querySelector(".reveal-button"), mastery = node.querySelector(".mastery"), checkbox = node.querySelector("input");
  meaning.hidden = !state.revealed; example.hidden = !state.revealed || !item.example; mastery.hidden = !state.revealed;
  button.hidden = state.revealed;
  button.onclick = reveal;
  node.querySelector(".speak-button").onclick = () => speak(item.word);
  checkbox.onchange = () => markKnown(item.word);
  checkbox.checked = state.known.has(item.word);
  study.replaceChildren(node);
}

function reveal() { state.revealed = true; render(); }
function speak(word) {
  if (!("speechSynthesis" in window)) { alert("이 브라우저는 음성 재생을 지원하지 않습니다."); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}
function nextWord() {
  const group = currentGroup(); if (!group) return;
  if (state.wordIndex < group.words.length - 1) { state.wordIndex++; state.revealed = false; render(); }
  else showSummary(group);
}
function previousWord() { if (state.wordIndex > 0) { state.wordIndex--; state.revealed = false; render(); } }
function showSummary(group) {
  document.querySelector("#progress").textContent = "단락 복습";
  const study = document.querySelector("#study");
  study.innerHTML = `<section class="summary"><p class="eyebrow">GROUP REVIEW</p><h2>비슷한 단어를 함께 비교하세요</h2><div class="summary-list">${group.words.map((item) => `<div class="summary-item"><strong>${escapeHtml(item.word)}</strong><span>${escapeHtml(item.meaning)}</span>${item.example ? `<p class="summary-example">“${escapeHtml(item.example)}”</p>` : ""}</div>`).join("")}</div><button class="reveal-button next-group" type="button">다음 단락</button></section>`;
  study.querySelector("button").onclick = () => { state.groupIndex++; state.wordIndex = 0; state.revealed = false; render(); };
}
function escapeHtml(text) { return text.replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }

async function markKnown(word) {
  state.known.add(word); saveKnown(); render();
  if (settings.repo && settings.token) {
    try { await updateRemoteMarkdown(word); } catch (error) { alert(`이 기기에는 저장됐지만 GitHub 동기화에 실패했습니다.\n${error.message}`); }
  }
}
async function updateRemoteMarkdown(word) {
  const endpoint = `https://api.github.com/repos/${settings.repo}/contents/vocab.md`;
  const headers = { Authorization: `Bearer ${settings.token}`, Accept: "application/vnd.github+json" };
  const response = await fetch(endpoint, { headers }); if (!response.ok) throw new Error("저장소 또는 토큰 권한을 확인하세요.");
  const file = await response.json();
  const markdown = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ""))));
  const updated = markdown.replace(new RegExp(`^(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(\\s+—[^\\n]*)?$`, "m"), `$1$2 ${KNOWN_TAG}`);
  const put = await fetch(endpoint, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ message: `Mark ${word} as known`, content: btoa(unescape(encodeURIComponent(updated))), sha: file.sha }) });
  if (!put.ok) throw new Error("vocab.md 커밋을 만들지 못했습니다.");
}

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input")) return;
  if (event.code === "Space") { event.preventDefault(); state.revealed ? nextWord() : reveal(); }
  if (event.key === "ArrowRight") nextWord(); if (event.key === "ArrowLeft") previousWord();
});
const dialog = document.querySelector("#settings-dialog");
document.querySelector("#settings-button").onclick = () => { document.querySelector("#repo-input").value = settings.repo; document.querySelector("#token-input").value = settings.token; dialog.showModal(); };
document.querySelector("#settings-form").onsubmit = () => { settings.repo = document.querySelector("#repo-input").value.trim(); settings.token = document.querySelector("#token-input").value.trim(); localStorage.setItem("vocab-repo", settings.repo); localStorage.setItem("vocab-token", settings.token); };
document.querySelector("#clear-settings").onclick = () => { settings.repo = settings.token = ""; localStorage.removeItem("vocab-repo"); localStorage.removeItem("vocab-token"); dialog.close(); };
document.querySelector("#checkpoint-button").onclick = () => { saveCheckpoint(); alert("여기까지 저장했습니다. 다음에 이 단어부터 이어서 학습합니다."); };
document.querySelector("#restart-button").onclick = () => {
  localStorage.removeItem(CHECKPOINT_KEY);
  state.groups = shuffle(state.groups); state.groupIndex = 0; state.wordIndex = 0; state.revealed = false;
  render();
};
fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" }).then((response) => response.text()).then((markdown) => {
  // 이미 아는 단어는 새 학습 회차를 시작할 때만 제외한다.
  const groups = parseVocab(markdown)
    .map((group) => ({ ...group, words: group.words.filter((item) => !item.known && !state.known.has(item.word)) }))
    .filter((group) => group.words.length);
  state.groups = restoreCheckpoint(shuffle(groups));
  render();
}).catch(() => { document.querySelector("#study").textContent = "vocab.md를 불러오지 못했습니다."; });
