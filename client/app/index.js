import React from 'react';
import { render } from 'react-dom';

import {
  BrowserRouter as Router,
  Route,
  Link,
  Switch
} from 'react-router-dom'

import App from './components/App/App';
import NotFound from './components/App/NotFound';

import './styles/dashboard/icomoon.css'
import './styles/dashboard/simple-line-icons.css'
import './styles/dashboard/header.css'

render((
  <Router>
      <Switch>
        <Route exact path="/" component={App} />
        <Route component={NotFound}/>
      </Switch>
  </Router>
), document.getElementById('app'));
