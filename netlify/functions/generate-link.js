const jwt = require('jsonwebtoken');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    // Parse the payload from GoHighLevel
    const { email, contact_id } = JSON.parse(event.body);

    if (!email || !contact_id) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing email or contact_id payload' }) 
      };
    }

    const jwtSecret = process.env.JWT_SECRET;
    const ghlWebhookUrl = process.env.GHL_WEBHOOK_URL;

    if (!jwtSecret || !ghlWebhookUrl) {
      console.error('Server Configuration Error: Missing Environment Variables');
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Server Configuration Error' }) 
      };
    }

    // Generate JWT with no expiration date (infinitely valid)
    const token = jwt.sign({ email }, jwtSecret);

    // Construct the Magic Link
    const magicLink = `https://thesilenceinstitute.com/access?token=${token}`;

    // Send the generated link back to the provided GoHighLevel Inbound Webhook
    const ghlResponse = await fetch(ghlWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contact_id: contact_id,
        magic_link: magicLink,
      }),
    });

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error(`GHL Webhook returned status ${ghlResponse.status}: ${errorText}`);
      throw new Error('Failed to send webhook to GHL');
    }

    // Return success to the original GHL POST request
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message: 'Magic link generated and sent to GHL successfully',
        success: true 
      }),
    };
  } catch (error) {
    console.error('Error generating link:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
