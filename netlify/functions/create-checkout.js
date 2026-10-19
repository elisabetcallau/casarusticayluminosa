const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { nights, checkIn, checkOut, guests, total } = JSON.parse(event.body);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Casa Rústica y Luminosa — Delta de l\'Ebre',
            description: `${checkIn} → ${checkOut} · ${nights} nit${nights > 1 ? 's' : ''} · ${guests} hoste${guests > 1 ? 's' : ''}`,
          },
          unit_amount: Math.round(total * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${event.headers.origin || 'https://casarusticayluminosa.netlify.app'}/success.html`,
      cancel_url: `${event.headers.origin || 'https://casarusticayluminosa.netlify.app'}/#reserva`,
      payment_intent_data: {
        description: `Reserva Casa Rústica y Luminosa: ${checkIn} → ${checkOut}`,
      },
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
