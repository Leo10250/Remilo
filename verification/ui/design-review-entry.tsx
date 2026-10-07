import { useLocalSearchParams } from 'expo-router';
import ExistingReview from '../../src/ui/design-review';
import P02Review from './p02-review';
export default function DesignReviewEntry() {
  const query = useLocalSearchParams();
  return query.p02 === 'sample' ? <P02Review /> : <ExistingReview />;
}
