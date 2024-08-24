const BASE_URL = "https://ideogram.ai/api/images";

// Cloudflare Worker main event listener
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'POST') {
    try {
      const { session_cookie_token, prompt } = await request.json();

      if (!session_cookie_token || !prompt) {
        return new Response('Session cookie token and prompt are required', { status: 400 });
      }

      const user_id = "-xnquyqCVSFOYTomOeUchbw";
      const channel_id = "LbF4xfurTryl5MUEZ73bDw";
      const aspect_ratio = "square";
      
      const requestId = await startInference(session_cookie_token, prompt, user_id, channel_id, aspect_ratio);
      if (!requestId) {
        return new Response('Failed to start inference', { status: 500 });
      }

      const imageData = await pollForResults(requestId, 30000); // Wait up to 30 seconds
      if (imageData) {
        return new Response(JSON.stringify(imageData), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response('No images found', { status: 404 });
      }
    } catch (error) {
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  } else {
    return new Response('Method not allowed', { status: 405 });
  }
}

// Start the inference process
async function startInference(session_cookie_token, prompt, user_id, channel_id, aspect_ratio) {
  const url = `${BASE_URL}/sample`;
  const headers = {
    'Accept': '*/*',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
  };

  const payload = {
    aspect_ratio,
    channel_id,
    prompt,
    raw_or_fun: 'raw',
    speed: 'slow',
    style: 'photo',
    user_id
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      cookies: {
        'session_cookie': session_cookie_token
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to start inference: ${response.statusText}`);
    }

    const data = await response.json();
    return data.request_id;
  } catch (error) {
    console.error(`Error starting inference: ${error.message}`);
    return null;
  }
}

// Poll for the results
async function pollForResults(requestId, timeout) {
  const endTime = Date.now() + timeout;

  while (Date.now() < endTime) {
    const imageData = await fetchGenerationMetadata(requestId);
    if (imageData) {
      return imageData;
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second before polling again
  }
  return null;
}

// Fetch generation metadata
async function fetchGenerationMetadata(requestId) {
  const url = `${BASE_URL}/retrieve_metadata_request_id/${requestId}`;
  const headers = {
    'Accept': '*/*',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0'
  };

  try {
    const response = await fetch(url, { method: 'GET', headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.resolution === 1024) {
      return data;
    }
  } catch (error) {
    console.error(`Error fetching metadata: ${error.message}`);
  }

  return null;
}
