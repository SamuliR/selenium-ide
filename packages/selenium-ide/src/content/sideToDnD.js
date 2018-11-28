export default (steps) => {
  const dndSteps = []
  steps.forEach(step => {
    let newStep = {
      allowFail: false,
      id: step.id,
      timeout: 10,
    }
    newStep = stepTargetValue(step, newStep)
    if(newStep !== null) {
      dndSteps.push(newStep)
    } else {
      return
    }
  })
  return dndSteps
}

const stepTargetValue = (step, newStep) => {
  switch (step.command) {
    case 'open':
      newStep.type = 'visit'
      newStep.url = step.target
      return newStep

    case 'scroll':
      newStep.type = 'scroll'
      newStep.amountPercent = Math.round(step.value / 10) * 10
      newStep.durationSeconds = step.target || 2
      return newStep

    case 'click':
      newStep.type = 'click'
      newStep.selector = step.target
      newStep.leftClick = true
      return newStep

    case 'assert text':
      newStep.type = 'has-text'
      newStep.text = step.value
      return newStep

    case 'type':
      newStep.type = 'input'
      newStep.selector = step.target
      newStep.value = step.value
      return newStep

    case 'sleep':
      newStep.type = 'sleep'
      newStep.time = step.value
      return newStep

    default:
      return null
  }
}
