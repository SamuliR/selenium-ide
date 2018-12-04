import React, { Component } from 'react'

import UiState from '../../stores/view/UiState'
import Editor from '../../containers/Editor'
import StepEditor from 'step-editor'
import propTypes from 'prop-types'
import sideToDnD from '../../../content/sideToDnD'

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
          name: 'Drag&Drop',
        },
      ],
      dndSteps: [],
    }
  }

  mirrorDnD = () => {
    this.setState({ dndSteps: sideToDnD(this.props.test.commands) })
  }

  saveSteps = steps => {
    this.setState({ dndSteps: steps }, console.log(this.state.dndSteps))
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
              saveSteps={this.saveSteps}
              savedSteps={this.state.dndSteps}
              syncEditor={this.mirrorDnD}
              send={this.props.send}
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
