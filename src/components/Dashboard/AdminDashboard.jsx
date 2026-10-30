import React from 'react';
// Correct import path as requested:
import Header from '../other/Header';
import CreateTask from '../other/CreateTask';
import AllTask from '../other/AllTask';
import InviteEmployee from '../other/InviteEmployee';

const AdminDashboard = (props) => {
  return (
    // The <body> tag already provides the light background from our global CSS
    <div className="min-h-screen">
      <div className="border-b border-neutral-300 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* The props for Header are passed through from App.js */}
          <Header changeUser={props.changeUser} data={props.data} />
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8"><InviteEmployee /></div>
        {/* Responsive grid for the main content modules */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
          {/* CreateTask form takes 1/3 of the width on large screens */}
          <div className="lg:col-span-1">
            <CreateTask />
          </div>

          {/* AllTask table takes 2/3 of the width on large screens */}
          <div className="lg:col-span-2">
            <AllTask />
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;