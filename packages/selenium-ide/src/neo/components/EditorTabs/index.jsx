import React, { Component } from 'react'

import Editor from '../../containers/Editor'
import FakeEditor from './FakeEditor'

import './style.css'

export default class EditorTabs extends Component {
  constructor(props) {
    super(props)
    this.state = {
      currentTab: 0,
      tabs: [
        {
          name: 'Editor',
        },
        {
          name: 'FakeEditor',
        }
      ]
    }
  }

  render() {
    if(Object.keys(this.props) === 0 ){
      return (
        <div>
          Loading..
        </div>
      )
    }
    console.log(this.props)
    return (
      <div className='EditorTabs'>
        <div className='tab-buttons-container'>
          {this.state.tabs.map((tab, index) => (
            <div
              className='tab'
              key={index}
              onClick={() => this.setState({ currentTab: index })}
              style={{ backgroundColor: index === this.state.currentTab ? '#F8F8F8' : null, paddingBottom: 11}}
            >
              {tab.name}
            </div>
          ))}
        </div>
        <div className='tab-editor-container'>
          {this.state.tabs[this.state.currentTab].name === 'Editor' ?
            <Editor
            url={this.props.url}
            urls={this.props.urls}
            setUrl={this.props.setUrl}
            test={this.props.test}
            callstackIndex={this.props.callstackIndex}
          />
          :
          <FakeEditor />
          }
        </div>
      </div>
    )
  }
}
