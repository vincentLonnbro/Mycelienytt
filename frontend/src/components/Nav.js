import { Link } from 'react-router-dom';

export default function Nav() {
	return (
		<nav aria-label="Main navigation">
			<Link to="/app">Home</Link>
			<Link to="/app/mat">Mat</Link>
		</nav>
	);
}