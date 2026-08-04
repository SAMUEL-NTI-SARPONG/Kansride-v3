const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

function loadRootEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
}

function requireDevelopment() {
  if ((process.env.NODE_ENV || 'development') === 'production') {
    throw new Error('Demo seed refused: NODE_ENV=production is not allowed.');
  }
}

async function main() {
  loadRootEnv();
  requireDevelopment();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required. Run migrations before seeding demo data.');

  const pool = new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM users LIMIT 1');

    const passenger = await upsertUser(client, {
      phone: '+233200000001', firstName: 'Demo', lastName: 'Passenger', role: 'passenger', verified: true,
    });
    await client.query(
      `INSERT INTO passengers (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = now()`,
      [passenger.id],
    );

    const driverUser = await upsertUser(client, {
      phone: '+233200000002', firstName: 'Demo', lastName: 'Driver', role: 'driver', verified: true,
    });
    const vehicle = await client.query(
      `INSERT INTO vehicles (registration_number, type, colour, make, model, owner_id, status)
       VALUES ('DEMO-KR-001', 'tricycle', 'green', 'KansRide', 'Pilot', $1, 'active')
       ON CONFLICT (registration_number) DO UPDATE SET owner_id = EXCLUDED.owner_id, status = 'active', updated_at = now()
       RETURNING id`,
      [driverUser.id],
    );
    await client.query(
      `INSERT INTO drivers (user_id, license_number, vehicle_id, rating, is_online, is_active, current_latitude, current_longitude, subscription_expires_at)
       VALUES ($1, 'DEMO-LIC-001', $2, '5.00', false, true, 5.60300000, -0.18700000, now() + interval '24 hours')
       ON CONFLICT (user_id) DO UPDATE SET vehicle_id = EXCLUDED.vehicle_id, is_active = true, is_online = false,
         current_latitude = EXCLUDED.current_latitude, current_longitude = EXCLUDED.current_longitude,
         subscription_expires_at = EXCLUDED.subscription_expires_at, updated_at = now()`,
      [driverUser.id, vehicle.rows[0].id],
    );
    const driver = await client.query('SELECT id FROM drivers WHERE user_id = $1', [driverUser.id]);

    const payment = await client.query(
      `INSERT INTO payments (user_id, type, amount_pesewas, method, status, provider_reference)
       VALUES ($1, 'subscription', 1000, 'mtn_mobile_money', 'successful', 'demo-subscription-payment')
       ON CONFLICT (provider_reference) DO UPDATE SET status = 'successful', updated_at = now()
       RETURNING id`,
      [driverUser.id],
    );
    const existingSubscription = await client.query(
      `SELECT id FROM driver_subscriptions WHERE driver_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [driver.rows[0].id],
    );
    let subscriptionId = existingSubscription.rows[0]?.id;
    if (!subscriptionId) {
      const subscription = await client.query(
        `INSERT INTO driver_subscriptions (driver_id, amount_pesewas, start_date, end_date, status, payment_id)
         VALUES ($1, 1000, now(), now() + interval '24 hours', 'active', $2)
         RETURNING id`,
        [driver.rows[0].id, payment.rows[0].id],
      );
      subscriptionId = subscription.rows[0].id;
    }
    await client.query('UPDATE payments SET subscription_id = $1, updated_at = now() WHERE id = $2', [subscriptionId, payment.rows[0].id]);

    const admin = await upsertUser(client, {
      phone: '+233200000003', firstName: 'Demo', lastName: 'Admin', role: 'super_admin', verified: true,
    });

    await client.query('COMMIT');
    console.log('Demo seed completed idempotently.');
    console.log(`Demo accounts: passenger ${passenger.phone}, driver ${driverUser.phone}, admin ${admin.phone}`);
    console.log('No passwords or production credentials were created.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function upsertUser(client, user) {
  const result = await client.query(
    `INSERT INTO users (phone_number, first_name, last_name, role, status, is_verified)
     VALUES ($1, $2, $3, $4, 'active', $5)
     ON CONFLICT (phone_number) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
       role = EXCLUDED.role, status = 'active', is_verified = EXCLUDED.is_verified, updated_at = now()
     RETURNING id, phone_number AS phone`,
    [user.phone, user.firstName, user.lastName, user.role, user.verified],
  );
  return result.rows[0];
}

main().catch((error) => {
  console.error(`Demo seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
