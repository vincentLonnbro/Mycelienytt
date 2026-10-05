import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import {Home, Mat} from '../pages/';
import {Nav, Footer} from '../components';

export default function App() {
    return(
        <BrowserRouter>
                <div className='page'>
						<Nav/>
						<div className='mainContent'>
							<Routes>
								<Route path='app' element={<Home />} />
								<Route path='app/home' element={<Home />} />
                                <Route path='app/mat' element={<Mat />} />
							</Routes>
						</div>
						<Footer />
					</div>
        </BrowserRouter>
    );
}