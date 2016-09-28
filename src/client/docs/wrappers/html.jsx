import React from 'react'
import DocumentTitle from 'react-document-title'
import { config } from 'config'

module.exports = React.createClass({
  propTypes () {
    return {
      route: React.PropTypes.object,
    }
  },
  render () {
    const page = this.props.route.page.data

    return (
       <div dangerouslySetInnerHTML={{ __html: page.body }} />
    )
  },
})
