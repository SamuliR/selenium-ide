const doc = window.document

const getSelector = (el) => {
  let path = [], parent
    while (parent = el.parentNode) {
      let tag = el.tagName, siblings
      path.unshift(el.id ? `#${el.id}` : (siblings = parent.children, [].filter.call(siblings, sibling => sibling.tagName === tag).length === 1 ? tag.toLowerCase() : `${tag.toLowerCase()}:nth-child(${1+[].indexOf.call(siblings, el)})`))
      el = parent
    }
  return `${path.join(' > ')}`
}

const addHighlight = () => {
  event.target.style.backgroundColor = '#77dd77'
}

const removeHighlight = () => {
  event.target.style.backgroundColor = ''
}

const sendSelector = (sendResponse) => {
  const selector = getSelector(event.target)

  sendResponse(selector)

  event.target.style.backgroundColor = ''

  doc.removeEventListener('mouseover', addHighlight, true)
  doc.removeEventListener('mouseout', removeHighlight, true)
  doc.removeEventListener('click', sendSelector, true)
}

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    if(request.state === 'get'){
      doc.addEventListener("mouseover", addHighlight, true);
      doc.addEventListener("mouseout", removeHighlight, true);
      doc.addEventListener("click", () => { sendSelector(sendResponse) }, true);
      return true;
    }
  }
)
