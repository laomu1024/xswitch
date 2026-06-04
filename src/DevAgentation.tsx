import { Agentation } from 'agentation';

export default function DevAgentation() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  return <Agentation />;
}
