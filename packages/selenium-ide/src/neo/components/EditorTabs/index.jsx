import React, { Component } from 'react'

import UiState from '../../stores/view/UiState'
import Editor from '../../containers/Editor'
import StepEditor from 'step-editor'
import propTypes from 'prop-types'
import sideToDnD from '../../../content/sideToDnD'

import './style.css'

/*problems
>steps arent matched 1:1 so its not possible to mirror them
perfectly in either direction

>mirroring only works selenium editor -> dnd because dnd
doesnt have enough commands

>selectors are broken in dnd due to differences in .step and
dnd step-formats

>url needs to be set in 'open'-commands target field or
it wont be mirrored over to DnD
*/

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
          name: 'Drag&Drop',
        },
      ],
      dndSteps: [],
    }
  }

  mirrorDnD = steps => {
    this.setState({ dndSteps: sideToDnD(steps) })
  }

  saveSteps = steps => {
    this.setState({ dndSteps: steps }, console.log(this.state.dndSteps))
  }

  onPlayClick = steps => {
    console.log('steps:', steps)
  }

  onPlayStepClick = step => {
    console.log('step:', step)
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
              mirrorDnD={this.mirrorDnD}
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
