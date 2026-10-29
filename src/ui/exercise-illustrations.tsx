import type { ImageSourcePropType } from 'react-native';
import type { MessageKey } from '../localization';

export type ExerciseIllustration = {
  /** Immutable, versioned authored reference; never infer this from an exercise name. */
  id: string;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  source: ImageSourcePropType;
};

// Only individually approved production exports belong in this static Metro map.
// Unapproved candidates remain in verification/local/artwork. Unknown backup IDs
// stay in native authored content and deliberately resolve to the text fallback.
export const exerciseIllustrations: readonly ExerciseIllustration[] = [{
  id: 'front-plank-v1', labelKey: 'exercise_front_plank', descriptionKey: 'exercise_front_plank_description',
  source: require('../../assets/exercises/front-plank-v1.webp'),
}, {
  id: 'bird-dog-v1', labelKey: 'exercise_bird_dog', descriptionKey: 'exercise_bird_dog_description',
  source: require('../../assets/exercises/bird-dog-v1.webp'),
}, {
  id: 'side-plank-v1', labelKey: 'exercise_side_plank', descriptionKey: 'exercise_side_plank_description',
  source: require('../../assets/exercises/side-plank-v1.webp'),
}, {
  id: 'running-v1', labelKey: 'exercise_running', descriptionKey: 'exercise_running_description',
  source: require('../../assets/exercises/running-v1.webp'),
}, {
  id: 'incline-treadmill-walking-v1', labelKey: 'exercise_incline_treadmill_walking', descriptionKey: 'exercise_incline_treadmill_walking_description',
  source: require('../../assets/exercises/incline-treadmill-walking-v1.webp'),
}, {
  id: 'walking-v1', labelKey: 'exercise_walking', descriptionKey: 'exercise_walking_description',
  source: require('../../assets/exercises/walking-v1.webp'),
}, {
  id: 'lat-pulldown-v1', labelKey: 'exercise_lat_pulldown', descriptionKey: 'exercise_lat_pulldown_description',
  source: require('../../assets/exercises/lat-pulldown-v1.webp'),
}, {
  id: 'machine-chest-press-v1', labelKey: 'exercise_machine_chest_press', descriptionKey: 'exercise_machine_chest_press_description',
  source: require('../../assets/exercises/machine-chest-press-v1.webp'),
}, {
  id: 'cable-face-pull-v1', labelKey: 'exercise_cable_face_pull', descriptionKey: 'exercise_cable_face_pull_description',
  source: require('../../assets/exercises/cable-face-pull-v1.webp'),
}, {
  id: 'dumbbell-shoulder-press-v1', labelKey: 'exercise_dumbbell_shoulder_press', descriptionKey: 'exercise_dumbbell_shoulder_press_description',
  source: require('../../assets/exercises/dumbbell-shoulder-press-v1.webp'),
}, {
  id: 'machine-shoulder-press-v1', labelKey: 'exercise_machine_shoulder_press', descriptionKey: 'exercise_machine_shoulder_press_description',
  source: require('../../assets/exercises/machine-shoulder-press-v1.webp'),
}, {
  id: 'incline-hammer-curl-v1', labelKey: 'exercise_incline_hammer_curl', descriptionKey: 'exercise_incline_hammer_curl_description',
  source: require('../../assets/exercises/incline-hammer-curl-v1.webp'),
}, {
  id: 'cable-triceps-pushdown-v1', labelKey: 'exercise_cable_triceps_pushdown', descriptionKey: 'exercise_cable_triceps_pushdown_description',
  source: require('../../assets/exercises/cable-triceps-pushdown-v1.webp'),
}, {
  id: 'goblet-squat-v1', labelKey: 'exercise_goblet_squat', descriptionKey: 'exercise_goblet_squat_description',
  source: require('../../assets/exercises/goblet-squat-v1.webp'),
}, {
  id: 'dumbbell-bench-press-v1', labelKey: 'exercise_dumbbell_bench_press', descriptionKey: 'exercise_dumbbell_bench_press_description',
  source: require('../../assets/exercises/dumbbell-bench-press-v1.webp'),
}, {
  id: 'dumbbell-rdl-v1', labelKey: 'exercise_dumbbell_rdl', descriptionKey: 'exercise_dumbbell_rdl_description',
  source: require('../../assets/exercises/dumbbell-rdl-v1.webp'),
}, {
  id: 'one-arm-dumbbell-row-v1', labelKey: 'exercise_one_arm_dumbbell_row', descriptionKey: 'exercise_one_arm_dumbbell_row_description',
  source: require('../../assets/exercises/one-arm-dumbbell-row-v1.webp'),
}];

export function getExerciseIllustration(id: string | null | undefined): ExerciseIllustration | undefined {
  return id ? exerciseIllustrations.find(entry => entry.id === id) : undefined;
}
