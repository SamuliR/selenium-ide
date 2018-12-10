export default (steps) => {
  const dndSteps = []
  steps.forEach(step => {
    let newStep = {
      allowFail: false,
      id: step.id,
      timeout: 10,
    }
    newStep = stepTargetValue(step, newStep)
    if (newStep !== null) {
      dndSteps.push(newStep)
    } else {
      return
    }
  })
  return dndSteps
}

const getCssSelector = (stepTargets, targets) => {
  if(stepTargets[0] === undefined){
    return 'undefined'
  }
  switch (stepTargets[targets][1]) {
    case 'id':
      return '#' + stepTargets[targets][0].slice(3, stepTargets[targets][0].length)

    case 'css:finder':
      return stepTargets[targets][0].slice(4, stepTargets[targets][0].length)

    case 'linkText':
      return getCssSelector(stepTargets, ++targets)

    case 'name':
      return getCssSelector(stepTargets, ++targets)

    default:
      return 'undefined'
  }
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
      newStep.durationSeconds = step.target || 2
      return newStep

    case 'click':
      newStep.type = 'click'
      newStep.leftClick = true
      newStep.selector = getCssSelector(step.targets, 0)
      if(newStep.selector === undefined){
        return null
      } else {
        return newStep
      }

    case 'assert text':
      newStep.type = 'has-text'
      newStep.text = step.value
      return newStep

    case 'type':
      newStep.type = 'input'
      newStep.value = step.value
      newStep.selector = getCssSelector(step.targets, 0)
      if(newStep.selector === undefined){
        return null
      } else {
        return newStep
      }

      case 'sleep':
      newStep.type = 'sleep'
      newStep.time = step.value
      return newStep

    default:
      return null
  }
}
