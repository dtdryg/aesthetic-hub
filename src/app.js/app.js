import React from 'react';
import PostForm from './components/PostForm';
import Posts from './components/Posts';

function App() {
  return (
    <div style={{ padding: '30px' }}>
      <h1>Aesthetic Hub</h1>
      <PostForm />
      <Posts />
    </div>
  );
}

export default App;
