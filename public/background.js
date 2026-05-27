chrome.action.onClicked.addListener(() => {
  chrome.windows.create({
    url: 'index.html',
    type: 'popup',
    width: 380,
    height: 600,
    focused: true
  });
});
