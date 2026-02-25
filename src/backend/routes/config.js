/**
 * GET /config → returns { client_id } from env (never expose secret). Replication guide 3.3.
 */
export function configRoutes(CLIENT_ID) {
  return (req, res) => {
    res.json({ client_id: CLIENT_ID || null });
  };
}
