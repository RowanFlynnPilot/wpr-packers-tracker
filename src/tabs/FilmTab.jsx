import FilmRoom from '../components/FilmRoom.jsx'
import ChunkLeaders from '../components/ChunkLeaders.jsx'
import DriveDNA from '../components/DriveDNA.jsx'

// The Film room tab. (Its chart, GameFlow, is a further lazy chunk — that's where recharts lives.)
export default function FilmTab() {
  return <><FilmRoom /><ChunkLeaders /><DriveDNA /></>
}
