// Inject page.ts (bundled as page.js) into Slack pages in MAIN world.
// This gives us access to the Quill editor instance and its API.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.startsWith("https://app.slack.com/")) {
    chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      files: ["page.js"],
    });
  }
});
