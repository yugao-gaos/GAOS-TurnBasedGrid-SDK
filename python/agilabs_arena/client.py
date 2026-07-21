"""Thin HTTP client over the AgiLabs Arena session API (spec/openapi.yaml).

No logic lives here — the server is authoritative. This is deliberately a
plain request/response mapping so any harness (or curl) stays equivalent.
"""

from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
import uuid
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_ID = "agilabs.turns"
PROTOCOL_VERSION = "1.0"
ARENA_CONTROL_EXTENSION = "agilabs.arena"
PARTICIPANT_ID_PATTERN = r"^[A-Za-z0-9_.:@-]{1,128}$"
_PARTICIPANT_ID_RE = re.compile(PARTICIPANT_ID_PATTERN)


class ArenaAPIError(Exception):
    """Non-2xx response from the API."""

    def __init__(self, status: int, error: str, code: str | None = None):
        super().__init__(f"HTTP {status}: {error}")
        self.status = status
        self.error = error
        self.code = code


class IllegalActionRejected(ArenaAPIError):
    """422 — the action was not in the legal set for this turn."""


class ProtocolMismatchError(Exception):
    """Response is not a valid AgiLabs Turns v1 envelope."""


def parse_turn_result(data: Any) -> dict[str, Any]:
    """Validate only the genre-neutral v1 envelope, not game observation fields."""
    if not isinstance(data, dict):
        raise ProtocolMismatchError("response is not an object")
    if data.get("protocol") != PROTOCOL_ID or data.get("protocolVersion") != PROTOCOL_VERSION:
        raise ProtocolMismatchError(f"expected {PROTOCOL_ID} {PROTOCOL_VERSION}")
    if data.get("kind") not in ("turn", "pending"):
        raise ProtocolMismatchError("response kind must be turn or pending")
    if (
        not isinstance(data.get("sessionId"), str)
        or not data["sessionId"].strip()
        or not isinstance(data.get("turnId"), str)
        or not data["turnId"].strip()
    ):
        raise ProtocolMismatchError("response sessionId/turnId missing")
    revision = data.get("revision")
    if (
        not isinstance(revision, int)
        or isinstance(revision, bool)
        or revision < 0
        or revision > 9_007_199_254_740_991
        or "turn" not in data
    ):
        raise ProtocolMismatchError("response revision/turn missing")
    if data["kind"] == "pending":
        submitted = data.get("submittedParticipants")
        awaiting = data.get("awaitingParticipants")
        if (
            not _is_participant_list(submitted)
            or not _is_participant_list(awaiting)
        ):
            raise ProtocolMismatchError("pending participant lists missing")
    return data


def _is_participant_list(value: Any) -> bool:
    return isinstance(value, list) and all(
        isinstance(participant_id, str)
        and _PARTICIPANT_ID_RE.fullmatch(participant_id) is not None
        for participant_id in value
    )


@dataclass
class Turn:
    turn_number: int
    narrative: str | None
    grid: str
    visual_events: list[dict[str, Any]]
    actions: list[dict[str, Any]]
    status: str  # "playing" | "won" | "failed"
    stars: int | None
    actions_used: int
    max_actions: int
    carrying: int | None
    control_revision: int | None = None
    units: list[dict[str, Any]] = field(default_factory=list)
    characters: list[dict[str, Any]] = field(default_factory=list)
    arena_outcome: str | None = None
    mode: str | None = None
    targetable_cells: list[list[int]] = field(default_factory=list)
    action_targeting: dict[str, Any] = field(default_factory=dict)
    dialogue_options: list[dict[str, Any]] = field(default_factory=list)
    items: list[dict[str, Any]] = field(default_factory=list)
    pois: list[dict[str, Any]] = field(default_factory=list)
    talking_to: dict[str, Any] | None = None
    dialogue_speaker: str | None = None
    dialogue_emotion: str | None = None

    @classmethod
    def from_json(cls, data: dict[str, Any]) -> "Turn":
        hud = data.get("hud", {})
        return cls(
            turn_number=data["turnNumber"],
            narrative=data.get("narrative"),
            grid=data["grid"],
            visual_events=data.get("visualEvents", []),
            actions=data.get("actions", []),
            status=data["status"],
            stars=data.get("stars"),
            actions_used=hud.get("actionsUsed", 0),
            max_actions=hud.get("maxActions", 0),
            carrying=hud.get("carrying"),
            control_revision=data.get("controlRevision"),
            units=hud.get("units", []),
            characters=hud.get("characters", []),
            arena_outcome=hud.get("arenaOutcome"),
            mode=hud.get("mode"),
            targetable_cells=hud.get("targetableCells", []),
            action_targeting=hud.get("actionTargeting", {}),
            dialogue_options=hud.get("dialogueOptions", []),
            items=hud.get("items", []),
            pois=hud.get("pois", []),
            talking_to=hud.get("talkingTo"),
            dialogue_speaker=hud.get("dialogueSpeaker"),
            dialogue_emotion=hud.get("dialogueEmotion"),
        )

    @property
    def legal_action_ids(self) -> list[str]:
        return [a["id"] for a in self.actions]

    @property
    def done(self) -> bool:
        return self.status != "playing"


class ArenaClient:
    def __init__(self, base_url: str = "http://localhost:8899", api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._bindings: dict[str, dict[str, Any]] = {}

    def _remember(self, result: dict[str, Any], participant_id: str | None = None) -> None:
        previous = self._bindings.get(result["sessionId"], {})
        binding = {
            "sessionId": result["sessionId"],
            "turnId": result["turnId"],
            "revision": result["revision"],
            "participantId": participant_id or previous.get("participantId", "player"),
        }
        turn = result.get("turn")
        control_revision = turn.get("controlRevision") if isinstance(turn, dict) else None
        if (
            isinstance(control_revision, int)
            and not isinstance(control_revision, bool)
            and 0 <= control_revision <= 9_007_199_254_740_991
        ):
            binding["controlRevision"] = control_revision
        self._bindings[result["sessionId"]] = binding

    def _call(self, method: str, path: str, body: dict | None = None) -> dict:
        headers = {"content-type": "application/json"}
        if self.api_key:
            headers["authorization"] = f"Bearer {self.api_key}"
        req = urllib.request.Request(
            self.base_url + path,
            method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
        )
        try:
            with urllib.request.urlopen(req) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            try:
                payload = json.loads(e.read())
                error = payload.get("error", str(e))
                code = payload.get("code") if isinstance(payload.get("code"), str) else None
            except Exception:
                error = str(e)
                code = None
            if e.code == 422:
                raise IllegalActionRejected(e.code, error, code) from None
            raise ArenaAPIError(e.code, error, code) from None

    def create_session(
        self,
        level_id: str | None = None,
        game_mode: str = "challenge",
        play_method: str = "autonomous_scored",
        season_id: str | None = None,
        game_id: str | None = None,
        community_level_id: str | None = None,
        participants: list[str] | None = None,
    ) -> tuple[str, Turn]:
        """Open a session.

        Per-level sessions (human/coach/autonomous_local practice) pass
        ``level_id``. A Challenge ``autonomous_scored`` submission passes
        ``game_id`` instead: the run spans that game type's FULL scored level
        set as one session (watch for ``level_advance`` visual events as the
        board rolls level-to-level).
        """
        body: dict[str, Any] = {
            "gameMode": game_mode,
            "playMethod": play_method,
        }
        if level_id:
            body["levelId"] = level_id
        if community_level_id:
            body["communityLevelId"] = community_level_id
        if game_id:
            body["gameId"] = game_id
        if season_id:
            body["seasonId"] = season_id
        if participants is not None:
            body["participants"] = participants
        result = parse_turn_result(self._call("POST", "/v1/sessions", body))
        if result["kind"] != "turn":
            raise ProtocolMismatchError("new session must start resolved")
        self._remember(result)
        return result["sessionId"], Turn.from_json(result["turn"])

    def get_turn_envelope(self, session_id: str) -> dict[str, Any]:
        result = parse_turn_result(self._call("GET", f"/v1/sessions/{session_id}/turn"))
        if result["sessionId"] != session_id:
            raise ProtocolMismatchError("response session does not match request")
        self._remember(result)
        return result

    def get_turn(self, session_id: str) -> Turn:
        return Turn.from_json(self.get_turn_envelope(session_id)["turn"])

    def submit_intent(
        self,
        session_id: str,
        command: Any,
        participant_id: str | None = None,
        submission_id: str | None = None,
    ) -> dict[str, Any]:
        return self._submit_intent_to(
            f"/v1/sessions/{session_id}/actions",
            session_id,
            command,
            participant_id,
            submission_id,
        )

    def _submit_intent_to(
        self,
        path: str,
        session_id: str,
        command: Any,
        participant_id: str | None = None,
        submission_id: str | None = None,
        control_revision: int | None = None,
    ) -> dict[str, Any]:
        binding = self._bindings.get(session_id)
        if binding is None:
            self.get_turn_envelope(session_id)
            binding = self._bindings[session_id]
        participant = participant_id or binding["participantId"]
        body = {
            "protocol": PROTOCOL_ID,
            "protocolVersion": PROTOCOL_VERSION,
            "sessionId": session_id,
            "turnId": binding["turnId"],
            "revision": binding["revision"],
            "participantId": participant,
            "command": command,
        }
        # Stable across an application retry after an ambiguous network error.
        body["submissionId"] = submission_id or f"{participant}:{binding['turnId']}"
        if control_revision is not None:
            body["extensions"] = {
                ARENA_CONTROL_EXTENSION: {"controlRevision": control_revision}
            }
        result = parse_turn_result(
            self._call("POST", path, body)
        )
        if result["sessionId"] != session_id:
            raise ProtocolMismatchError("response session does not match request")
        self._remember(result, participant)
        return result

    # ------------------------------------------------ hosted Arena mode

    def arena_catalog(self) -> dict[str, Any]:
        """Return the host's stable map summaries and game-owned team presets."""
        return self._call("GET", "/v1/arena/maps")

    def join_arena_queue(
        self,
        map_id: str,
        team_id: str,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        """Join live matchmaking. Reuse request_id after an ambiguous retry."""
        return self._call("POST", "/v1/arena/matchmaking", {
            "mapId": map_id,
            "teamId": team_id,
            "requestId": request_id or str(uuid.uuid4()),
        })

    def arena_queue_ticket(self, queue_id: str, ticket_id: str) -> dict[str, Any]:
        return self._call("GET", f"/v1/arena/matchmaking/{queue_id}/{ticket_id}")

    def cancel_arena_queue_ticket(self, queue_id: str, ticket_id: str) -> dict[str, Any]:
        return self._call("DELETE", f"/v1/arena/matchmaking/{queue_id}/{ticket_id}")

    def _parse_arena_room(self, data: Any, match_id: str) -> dict[str, Any]:
        if not isinstance(data, dict):
            raise ProtocolMismatchError("Arena room is not an object")
        if data.get("sessionId") != match_id or data.get("matchId") != match_id:
            raise ProtocolMismatchError("Arena room does not match request")
        participant = data.get("participantId")
        if not isinstance(participant, str) or _PARTICIPANT_ID_RE.fullmatch(participant) is None:
            raise ProtocolMismatchError("Arena room participant missing")
        turn = parse_turn_result(data.get("turn"))
        if turn["sessionId"] != match_id:
            raise ProtocolMismatchError("Arena room turn does not match request")
        self._remember(turn, participant)
        return {**data, "turn": turn}

    def get_arena_room(self, match_id: str) -> dict[str, Any]:
        """Read-only room snapshot; does not claim or heartbeat the seat."""
        return self._parse_arena_room(
            self._call("GET", f"/v1/arena/matches/{match_id}"),
            match_id,
        )

    def set_arena_presence(self, match_id: str, connected: bool) -> dict[str, Any]:
        return self._parse_arena_room(
            self._call(
                "POST",
                f"/v1/arena/matches/{match_id}/presence",
                {"connected": connected},
            ),
            match_id,
        )

    def heartbeat_arena_match(self, match_id: str) -> dict[str, Any]:
        return self.set_arena_presence(match_id, True)

    def connect_arena_match(self, match_id: str) -> dict[str, Any]:
        """Claim a matched seat; the second claim starts the turn timers."""
        return self.set_arena_presence(match_id, True)

    def disconnect_arena_match(self, match_id: str) -> dict[str, Any]:
        return self.set_arena_presence(match_id, False)

    def get_arena_turn_envelope(self, match_id: str) -> dict[str, Any]:
        result = parse_turn_result(
            self._call("GET", f"/v1/arena/matches/{match_id}/turn")
        )
        if result["sessionId"] != match_id:
            raise ProtocolMismatchError("response session does not match request")
        binding = self._bindings.get(match_id)
        # Turn envelopes intentionally omit authenticated seat identity. Avoid
        # inventing the ordinary solo `player` seat when callers poll first;
        # submit_arena_intent will recover the real room binding on demand.
        if binding is not None:
            self._remember(result, binding["participantId"])
        return result

    def submit_arena_intent(
        self,
        match_id: str,
        command: Any,
        submission_id: str | None = None,
        control_revision: int | None = None,
    ) -> dict[str, Any]:
        binding = self._bindings.get(match_id)
        if binding is None:
            self.get_arena_room(match_id)
            binding = self._bindings[match_id]
        expected_control_revision = (
            control_revision
            if control_revision is not None
            else binding.get("controlRevision")
        )
        if (
            not isinstance(expected_control_revision, int)
            or isinstance(expected_control_revision, bool)
            or expected_control_revision < 0
            or expected_control_revision > 9_007_199_254_740_991
        ):
            raise ProtocolMismatchError("Arena controlRevision unavailable")
        participant = binding["participantId"]
        return self._submit_intent_to(
            f"/v1/arena/matches/{match_id}/actions",
            match_id,
            command,
            participant,
            submission_id
            or f"{participant}:{binding['turnId']}:control:{expected_control_revision}",
            expected_control_revision,
        )

    def submit_action(
        self,
        session_id: str,
        action_id: str,
        x: int | None = None,
        y: int | None = None,
        index: int | None = None,
        participant_id: str | None = None,
        submission_id: str | None = None,
        poll_interval: float = 0.25,
        max_poll_attempts: int = 120,
    ) -> Turn:
        body: dict[str, Any] = {"id": action_id}
        if x is not None:
            body["x"] = x
        if y is not None:
            body["y"] = y
        if index is not None:
            body["index"] = index
        result = self.submit_intent(
            session_id,
            body,
            participant_id=participant_id,
            submission_id=submission_id,
        )
        if result["kind"] == "turn":
            return Turn.from_json(result["turn"])
        pending_revision = result["revision"]
        for _ in range(max_poll_attempts):
            time.sleep(poll_interval)
            polled = self.get_turn_envelope(session_id)
            if polled["kind"] == "turn" and polled["revision"] > pending_revision:
                return Turn.from_json(polled["turn"])
        raise ArenaAPIError(408, f"timed out waiting after {max_poll_attempts} polls")

    def submit_session(self, session_id: str, harness_category: str | None = None) -> dict:
        body = {"harnessCategory": harness_category} if harness_category else {}
        return self._call("POST", f"/v1/sessions/{session_id}/submit", body)

    def lab_level_versions(self) -> list[dict]:
        return self._call("GET", "/levels/lab/versions")  # type: ignore[return-value]

    def report_unpaid_challenge(self, game_id: str, stars: int, steps: int) -> dict:
        """Self-report an unpaid Challenge claim (authenticated, stored unverified)."""
        return self._call(
            "POST",
            "/leaderboards/challenge/unpaid",
            {"gameId": game_id, "stars": stars, "steps": steps},
        )

    def challenge_boards(self, game_id: str) -> dict:
        return self._call("GET", f"/leaderboards/challenge/{game_id}")
