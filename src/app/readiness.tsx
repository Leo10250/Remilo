import { Redirect } from 'expo-router';
/** Retain the old route for links; permissions now live directly in Settings. */
export default function Readiness() { return <Redirect href="/settings" />; }
