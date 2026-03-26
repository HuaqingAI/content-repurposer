// Ensure NODE_ENV=test so React development builds load correctly
// (React 19 omits `act` and other test APIs from production bundles)
process.env.NODE_ENV = 'test'
