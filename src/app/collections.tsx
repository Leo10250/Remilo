import { Redirect } from 'expo-router';
// Older internal links remain safe; Browse is an overlay on each root destination.
export default function Collections() { return <Redirect href="/" />; }
