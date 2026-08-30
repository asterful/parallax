import { useState } from "react";
import type { SearchItem } from "./api.search";
import type { Track } from "./api.playlist.$playlistId";

export default function Index() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingPlaylistId, setLoadingPlaylistId] = useState<string | null>(null);

  // Queue & Player State
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const currentTrack = queue[currentIndex];

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`Search failed with status ${res.status}`);
      const data = await res.json();

      setResults(data.results || []);
      if ((data.results || []).length === 0) {
        setErrorMessage("No results found. Try a different search term or paste a direct URL.");
      }
    } catch (err: any) {
      console.error("Search Error:", err);
      setErrorMessage(err.message || "Failed to complete search.");
    } finally {
      setIsSearching(false);
    }
  };

  const playSingleVideo = (video: SearchItem) => {
    setQueue([{ id: video.id, title: video.title, uploader: video.uploader }]);
    setCurrentIndex(0);
  };

  const loadAndPlayPlaylist = async (playlist: SearchItem) => {
    setLoadingPlaylistId(playlist.id);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/playlist/${playlist.id}`);
      if (!res.ok) throw new Error("Failed to load playlist tracks.");
      const data = await res.json();

      if (data.tracks && data.tracks.length > 0) {
        setQueue(data.tracks);
        setCurrentIndex(0);
      } else {
        setErrorMessage("Playlist contains no playable tracks.");
      }
    } catch (err: any) {
      console.error("Playlist Error:", err);
      setErrorMessage("Failed to fetch playlist tracks.");
    } finally {
      setLoadingPlaylistId(null);
    }
  };

  const nextTrack = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const prevTrack = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const jumpToTrack = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <s-page heading="Store Music Streamer">
      {/* Search Section */}
      <s-section heading="Search Videos & Playlists">
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <s-text-field
              label="Query or URL"
              value={query}
              onInput={(e: any) => setQuery(e.target?.value || e.detail?.value || "")}
              onKeyDown={(e: any) => e.key === "Enter" && handleSearch()}
              placeholder="Search songs, playlists, or paste a YouTube URL..."
            />
          </div>
          <s-button
            onClick={handleSearch}
            {...(isSearching ? { loading: true } : {})}
          >
            Search
          </s-button>
        </div>

        {errorMessage && (
          <div style={{ color: "#d32f2f", marginTop: "12px", fontSize: "14px" }}>
            {errorMessage}
          </div>
        )}

        {/* Results List */}
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {results.map((item) => (
            <s-box
              key={item.id}
              padding="base"
              borderWidth="base"
              borderRadius="base"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      backgroundColor: item.type === "playlist" ? "#e4e5e7" : "#008060",
                      color: item.type === "playlist" ? "#303030" : "#ffffff",
                      padding: "2px 6px",
                      borderRadius: "4px",
                      marginRight: "8px",
                    }}
                  >
                    {item.type}
                  </span>
                  <strong style={{ fontSize: "14px" }}>{item.title}</strong>
                  <div style={{ fontSize: "12px", color: "#616161", marginTop: "4px" }}>
                    {item.uploader} {item.trackCount ? `• ${item.trackCount} tracks` : ""}
                  </div>
                </div>

                {item.type === "video" ? (
                  <s-button onClick={() => playSingleVideo(item)}>
                    Play Song
                  </s-button>
                ) : (
                  <s-button
                    onClick={() => loadAndPlayPlaylist(item)}
                    {...(loadingPlaylistId === item.id ? { loading: true } : {})}
                  >
                    Play Playlist
                  </s-button>
                )}
              </div>
            </s-box>
          ))}
        </div>
      </s-section>

      {/* Active Audio Player Section */}
      {currentTrack && (
        <s-section heading="Now Playing">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <div style={{ marginBottom: "12px" }}>
              <strong style={{ fontSize: "16px", display: "block" }}>
                {currentTrack.title}
              </strong>
              <span style={{ fontSize: "13px", color: "#616161" }}>
                {currentTrack.uploader} • Track {currentIndex + 1} of {queue.length}
              </span>
            </div>

            <audio
              key={currentTrack.id}
              src={`/api/audio/${currentTrack.id}`}
              controls
              autoPlay
              onEnded={nextTrack}
              style={{ width: "100%", marginBottom: "12px" }}
            />

            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <s-button
                onClick={prevTrack}
                {...(currentIndex === 0 ? { disabled: true } : {})}
              >
                Previous
              </s-button>
              <s-button
                onClick={nextTrack}
                {...(currentIndex === queue.length - 1 ? { disabled: true } : {})}
              >
                Next Track
              </s-button>
            </div>

            {/* Playlist Tracklist View */}
            {queue.length > 0 && (
              <div style={{ borderTop: "1px solid #e1e3e5", paddingTop: "12px" }}>
                <strong style={{ fontSize: "13px", display: "block", marginBottom: "10px", color: "#303030" }}>
                  Playlist Tracks ({queue.length})
                </strong>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    maxHeight: "260px",
                    overflowY: "auto",
                    paddingRight: "4px",
                  }}
                >
                  {queue.map((track, idx) => {
                    const isActive = idx === currentIndex;
                    return (
                      <div
                        key={`${track.id}-${idx}`}
                        onClick={() => jumpToTrack(idx)}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          cursor: "pointer",
                          backgroundColor: isActive ? "#f0fdf4" : "#f6f6f7",
                          border: isActive ? "1px solid #008060" : "1px solid #e1e3e5",
                          transition: "background-color 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: "bold",
                              color: isActive ? "#008060" : "#616161",
                              minWidth: "20px",
                            }}
                          >
                            {isActive ? "▶" : `${idx + 1}.`}
                          </span>
                          <span
                            style={{
                              fontSize: "13px",
                              fontWeight: isActive ? "bold" : "normal",
                              color: isActive ? "#008060" : "#303030",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {track.title}
                          </span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#616161", marginLeft: "12px", flexShrink: 0 }}>
                          {track.uploader}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </s-box>
        </s-section>
      )}
    </s-page>
  );
}