import { Redirect } from 'expo-router';
// Older internal links return safely to the Agenda root.
export default function Collections() { return <Redirect href="/" />; }
