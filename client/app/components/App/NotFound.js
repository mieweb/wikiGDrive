import React from 'react';
import { Link } from 'react-router-dom';
import Header from '../Dashboard/Header';
import Footer from '../Dashboard/Footer';

const NotFound = () => (
  <>
    <Header />
    <div className="container" style={{marginTop: "200px"}}>
    <h2>Page not found</h2>
    </div>
    <Footer />
  </>
);

export default NotFound;
