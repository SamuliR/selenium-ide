import React, { Component } from 'react'

import UiState from '../../stores/view/UiState'
import Editor from '../../containers/Editor'
import StepEditor from 'step-editor'
import propTypes from 'prop-types'

import './style.css'

export default class EditorTabs extends Component {
  constructor(props) {
    super(props)
    this.state = {
      currentTab: 0,
      tabs: [
        {
          name: 'Selenium Editor',
        },
        {
          name: 'DnD',
        },
      ],
      dndSteps: [],
    }
  }

  saveSteps = steps => {
    this.setState({ dndSteps: steps })
  }

  onPlayClick = (steps) => {
    console.log('steps:', steps)
    this.toSide(steps)
  }

  onPlayStepClick = (step) => {
    console.log('step:', step)
  }

  getTarget = (step) => {
    switch (step.type) {
      case 'visit':
        return step.url

      case 'scroll':
        return step.amoutPercent

      case 'click':
        return step.selector

      case 'resolution':
        return ''

      case 'has-text':
        return 'document.body' //locator

      case 'input':
        return step.selector

      case 'key-press':
        return 'document.body' //locator

      case 'sleep':
        return ''

      case 'navigation':
        return ''
    }
  }

  getValue = (step) => {
    switch (step.type) {
      case 'visit':
        return ''

      case 'scroll':
        return step.durationSeconds

      case 'click':
        return ''

      case 'resolution':
        return step.resolution

      case 'has-text':
        return step.text

      case 'input':
        return step.value

      case 'key-press':
        return step.keys

      case 'sleep':
        return step.time

      case 'navigation':
        return step.action
    }
  }

  getCommand = (step) => {
    switch (step.type) {
      case 'visit':
        return 'open'

      case 'scroll':
        return 'scroll'

      case 'click':
        return 'click'

      case 'resolution':
        return '' //no such command

      case 'has-text':
        return 'verify text'

      case 'input':
        return 'type'

      case 'key-press':
        return 'send keys'

      case 'sleep':
        return 'sleep'

      case 'navigation':
        return '' //no such command
    }
  }

  toSide = (steps) => {
    const sideTest = []
    steps.forEach(step => {
      sideTest.concat({
        id: step.id,
        comment: '',
        command: this.getCommand(step),
        target: this.getTarget(step),
        targets: [],
        value: this.getValue(step),
      })
    })
    console.log("sideTest", sideTest)
  }

  render() {
    if (this.state.currentTab === 1) {
      UiState.minimizeConsole()
    } else {
      UiState.restoreConsoleSize()
    }
    return (
      <div className="editor-tabs">
        <div className="buttons-container">
          {this.state.tabs.map((tab, index) => (
            <div
              className="tab"
              key={index}
              onClick={() => this.setState({ currentTab: index })}
              style={{
                backgroundColor:
                  index === this.state.currentTab ? '#F8F8F8' : null,
              }}
            >
              {tab.name}
            </div>
          ))}
        </div>
        <div
          className="editor-container"
          style={{ width: '100%', overflowY: 'scroll' }}
        >
          {this.state.currentTab === 0 ? (
            <Editor
              url={this.props.url}
              urls={this.props.urls}
              setUrl={this.props.setUrl}
              test={this.props.test}
              callstackIndex={this.props.callstackIndex}
            />
          ) : (
            <StepEditor
              onPlayClick={this.onPlayClick}
              onPlayStepClick={this.onPlayStepClick}
              saveSteps={this.saveSteps}
              savedSteps={this.state.dndSteps}
            />
          )}
        </div>
      </div>
    )
  }
}

EditorTabs.propTypes = {
  url: propTypes.string.isRequired,
}
