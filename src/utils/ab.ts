function AbCloak() {
  const win = window.open('about:blank', '_blank');
  if (!win) return;

  const doc = win.document;
  doc.open();
  doc.write(`
    <!doctype html>
    <html>
      <head>
        <title>Google Drive</title>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <style>
          html, body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            height: 100%;
            background-color: #0B0F19;
          }
          iframe {
            border: none;
            width: 100%;
            height: 100%;
          }
        </style>
      </head>
      <body>
        <iframe src=${window.location.href} allowfullscreen></iframe>
      </body>
    </html>
  `);
  doc.close();

  window.location.replace('https://www.docs.google.com');
}

export { AbCloak };
