import { Redirect } from 'expo-router';

// Metro replaces only this entry for the opt-in web fixture review.
export default function DesignReviewUnavailable() {
  return <Redirect href="/" />;
}
