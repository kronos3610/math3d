import { Link } from 'react-router-dom';

export default function NotFound() {
    return <section className="topic-page">
        <h1>Lesson not found</h1>
        <p>This address does not match a lesson. Browse the topics to find a visualization.</p>
        <Link to="/" className="lab-button">Explore topics</Link>
    </section>;
}
