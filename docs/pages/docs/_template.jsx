import React from 'react'
import { Link } from 'react-router'
import Breakpoint from 'components/Breakpoint'
import find from 'lodash/find'
import { prefixLink } from 'gatsby-helpers'
import { config } from 'config'

import typography from 'utils/typography'
const { rhythm } = typography

module.exports = React.createClass({
  propTypes() {
    return {
      route: React.PropTypes.object,
    }
  },
  contextTypes: {
    router: React.PropTypes.object.isRequired,
  },
  handleTopicChange(e) {
    return this.context.router.push(e.target.value)
  },

  render() {
    const childPages = config.docPages.map((p) => {
      const page = find(this.props.route.pages, (_p) => _p.path === p)
      console.log(page);
      return {
        title: page.data.title,
        path: page.path,
      }
    });
    const grandChildPages = {};
    config.docPages.map((p) => {
      const page = find(this.props.route.pages, (_p) => _p.path === p)
      if (page.path.indexOf('_') === -1) {
        return null;
      }
      const parentPagePath = page.path.substring(0, page.path.indexOf('_')) + '/';
      const pageInfo = {
        title: page.data.title,
        path: page.path,
      }
      if (!Array.isArray(grandChildPages[parentPagePath])) {
        grandChildPages[parentPagePath] = [];
      }
      grandChildPages[parentPagePath].push(pageInfo);
    }).filter(page => page !== null);
    const docOptions = childPages.map((child) =>
      <option
        key={prefixLink(child.path) }
        value={prefixLink(child.path) }
        >
        {child.title}
      </option>

    )
    const docPages = childPages.map((child) => {
      const isGrandChild = child.path.indexOf('_') > 0;
      if (isGrandChild) {
        return null;
      }

      // Structure is /docs/jupyter/
      const isChildPath = child.path.split('\/').filter(part => part.length > 0).length === 2;
      const isActive = prefixLink(child.path) === this.props.location.pathname || (isChildPath && this.props.location.pathname.indexOf(prefixLink(child.path)) === 0);
      let childPagesForThis = ("");

      const pathParts = this.props.location.pathname.split('\/').filter(function (part) { return part.length > 0; });
      const docPage = pathParts[pathParts.length - 1];
      const isGrandChildActive = Array.isArray(grandChildPages[child.path]) &&
        grandChildPages[child.path].filter(page => prefixLink(page.path) === this.props.location.pathname).length > 0;

      if (((isActive && isChildPath) || isGrandChildActive) && grandChildPages[child.path]) {
        let liItems = grandChildPages[child.path].map((childPage) => {
          const childPath = childPage.path;
          const title = childPage.title;
          const isThisChildActive = prefixLink(childPath) === this.props.location.pathname
          return (<li
            key={childPath}
            style={{
              marginBottom: rhythm(1 / 2),
            }}
            >
            <Link
              to={prefixLink(childPath) }
              style={{
                textDecoration: 'none',
              }}
              >
              {isThisChildActive ? <strong>{title}</strong> : title}
            </Link>
          </li>);
        });
        childPagesForThis = (
          <ul style={{ listStyle: 'none', marginTop: '0.5em' }}>
            {liItems}
          </ul>
        );
      }

      const isChildActive = this.props.location.pathname.startsWith(prefixLink(child.path));
      return (
        <li
          key={child.path}
          style={{
            marginBottom: rhythm(1 / 2),
          }}
          >
          <Link
            to={prefixLink(child.path) }
            style={{
              textDecoration: 'none',
            }}
            >
            {isActive ? <strong>{child.title}</strong> : child.title}
            {childPagesForThis}
          </Link>
        </li>
      )
    }).filter(item => item !== null);

    return (
      <div>
        <Breakpoint
          mobile
          >
          <div
            style={{
              overflowY: 'auto',
              paddingRight: `calc(${rhythm(1 / 2)} - 1px)`,
              position: 'absolute',
              width: `calc(${rhythm(8)} - 1px)`,
              borderRight: '1px solid lightgrey',
            }}
            >
            <ul
              style={{
                listStyle: 'none',
                marginLeft: 0,
                marginTop: rhythm(1 / 2),
              }}
              >
              {docPages}
            </ul>
          </div>
          <div
            style={{
              padding: `0 ${rhythm(1)}`,
              paddingLeft: `calc(${rhythm(8)} + ${rhythm(1)})`,
            }}
            >
            {this.props.children}
          </div>
        </Breakpoint>
        <Breakpoint>
          <strong>Topics: </strong>
          {' '}
          <select
            defaultValue={this.props.location.pathname}
            onChange={this.handleTopicChange}
            >
            {docOptions}
          </select>
          <br />
          <br />
          {this.props.children}
        </Breakpoint>
      </div>
    )
  },
})
