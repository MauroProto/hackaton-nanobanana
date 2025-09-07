import React from 'react';

function AppSimple() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', minHeight: '100vh' }}>
      <h1 style={{ color: '#333' }}>Nanobanan - Test</h1>
      <p>Si puedes ver este mensaje, la aplicación está funcionando.</p>
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: 'white', borderRadius: '5px' }}>
        <h2>Estado del Sistema:</h2>
        <ul>
          <li>✅ React funcionando</li>
          <li>✅ Aplicación renderizando</li>
          <li>✅ Servidor respondiendo</li>
        </ul>
      </div>
    </div>
  );
}

export default AppSimple;