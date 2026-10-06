import { useLocalSearchParams } from 'expo-router';
import { AgendaScreen } from '../index';
export default function ListDestination() {
  const { id, noList } = useLocalSearchParams<{ id: string; noList?: string }>();
  return <AgendaScreen key={JSON.stringify([id, noList])} destination={{ kind: 'list', listId: noList === 'true' ? null : id }} />;
}
