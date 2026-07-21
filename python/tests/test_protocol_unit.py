import io
import urllib.error

import pytest

from agilabs_arena import ArenaAPIError, ArenaClient, ProtocolMismatchError, Turn, parse_turn_result


TURN = {
    "turnNumber": 0,
    "controlRevision": 0,
    "narrative": None,
    "grid": "@ .",
    "visualEvents": [],
    "actions": [{"id": "Action 1", "params": "none"}],
    "status": "playing",
    "hud": {"actionsUsed": 0, "maxActions": 4, "carrying": None},
}


def envelope(kind="turn", revision=0, **extra):
    return {
        "protocol": "agilabs.turns",
        "protocolVersion": "1.0",
        "kind": kind,
        "sessionId": "s1",
        "turnId": f"s1:{revision}",
        "revision": revision,
        "turn": {**TURN, "turnNumber": revision},
        **extra,
    }


def test_rejects_unversioned_turn_shape():
    with pytest.raises(ProtocolMismatchError):
        parse_turn_result(TURN)
    with pytest.raises(ProtocolMismatchError):
        parse_turn_result({**envelope(), "sessionId": ""})
    with pytest.raises(ProtocolMismatchError):
        parse_turn_result({**envelope(), "turnId": ""})
    with pytest.raises(ProtocolMismatchError):
        parse_turn_result({**envelope(), "revision": -1})


def test_turn_retains_unit_integrity_and_character_metadata():
    unit = {
        "id": "hacker",
        "team": "player",
        "at": [1, 2],
        "hp": 2,
        "maxHp": 2,
        "character": "hacker",
        "cast": "hacker",
        "controlMode": "direct",
        "abilities": ["hack_drone", "remote_control"],
        "statuses": [
            {"kind": "shield_field", "phase": "active", "remaining": 1, "capacity": 2}
        ],
    }
    character = {key: value for key, value in unit.items() if key not in {"hp", "maxHp"}}

    turn = Turn.from_json({
        **TURN,
        "hud": {
            **TURN["hud"],
            "units": [unit],
            "characters": [character],
            "arenaOutcome": "draw",
            "mode": "dialogue",
            "targetableCells": [[1, 2]],
            "actionTargeting": {"Action 6": {"targetableCells": [[1, 2]]}},
            "dialogueOptions": [{"index": 0, "text": "Hold position."}],
            "talkingTo": {
                "id": "hacker",
                "at": [1, 2],
                "character": "hacker",
                "emotion": "focused",
                "speaker": "npc",
            },
            "dialogueSpeaker": "npc",
            "dialogueEmotion": "focused",
        },
    })

    assert turn.units == [unit]
    assert turn.characters == [character]
    assert turn.arena_outcome == "draw"
    assert turn.control_revision == 0
    assert turn.mode == "dialogue"
    assert turn.targetable_cells == [[1, 2]]
    assert turn.dialogue_options == [{"index": 0, "text": "Hold position."}]
    assert turn.talking_to["character"] == "hacker"
    assert turn.dialogue_speaker == "npc"
    assert turn.dialogue_emotion == "focused"
    assert Turn.from_json(TURN).units == []
    assert Turn.from_json(TURN).characters == []
    assert Turn.from_json(TURN).arena_outcome is None


def test_wraps_commands_and_polls_a_pending_turn_once():
    responses = [
        envelope(),
        envelope(
            "pending",
            submittedParticipants=["player"],
            awaitingParticipants=["remote"],
        ),
        envelope(revision=1),
    ]
    calls = []
    client = ArenaClient("https://example.test")

    def fake_call(method, path, body=None):
        calls.append((method, path, body))
        return responses.pop(0)

    client._call = fake_call  # type: ignore[method-assign]
    session_id, _ = client.create_session(level_id="test", play_method="human")
    turn = client.submit_action(
        session_id,
        "Action 1",
        submission_id="request-1",
        poll_interval=0,
        max_poll_attempts=1,
    )
    assert turn.turn_number == 1
    assert calls[1][1] == "/v1/sessions/s1/actions"
    assert calls[1][2] == {
        "protocol": "agilabs.turns",
        "protocolVersion": "1.0",
        "sessionId": "s1",
        "turnId": "s1:0",
        "revision": 0,
        "participantId": "player",
        "submissionId": "request-1",
        "command": {"id": "Action 1"},
    }
    assert calls[2][1] == "/v1/sessions/s1/turn"


def test_explicit_empty_participants_is_not_silently_changed_to_solo():
    calls = []
    client = ArenaClient("https://example.test")

    def fake_call(method, path, body=None):
        calls.append((method, path, body))
        return envelope()

    client._call = fake_call  # type: ignore[method-assign]
    client.create_session(level_id="test", play_method="human", participants=[])
    assert calls[0][2]["participants"] == []


def test_preserves_stable_conflict_codes(monkeypatch):
    response = io.BytesIO(b'{"error":"expected a newer cursor","code":"stale_turn"}')

    def fail(_request):
        raise urllib.error.HTTPError(
            "https://example.test/v1/sessions/s1/turn",
            409,
            "Conflict",
            {},
            response,
        )

    monkeypatch.setattr("urllib.request.urlopen", fail)
    with pytest.raises(ArenaAPIError) as caught:
        ArenaClient("https://example.test").get_turn_envelope("s1")
    assert caught.value.status == 409
    assert caught.value.code == "stale_turn"


def test_discovers_hosted_arena_catalog():
    calls = []
    client = ArenaClient("https://example.test")
    catalog = {
        "maps": [{"id": "arena-s1-1", "gameId": "arena", "version": 1, "name": "Arena Exhibition"}],
        "teams": [{"id": "playerbot-mica", "name": "Playerbot + MICA", "members": []}],
    }

    def fake_call(method, path, body=None):
        calls.append((method, path, body))
        return catalog

    client._call = fake_call  # type: ignore[method-assign]
    assert client.arena_catalog() == catalog
    assert calls == [("GET", "/v1/arena/maps", None)]


def test_arena_single_match_queue_turn_presence_and_room_outcome():
    def match_envelope(kind="turn", **extra):
        out = envelope(kind, **extra)
        out["sessionId"] = "m1"
        out["turnId"] = "m1:0"
        return out

    resolved_turn = match_envelope(revision=1)
    resolved_turn["turnId"] = "m1:1"
    resolved_turn["turn"]["turnNumber"] = 1
    active = {
        "matchId": "m1",
        "sessionId": "m1",
        "status": "active",
        "participantId": "north",
        "readyDeadline": 120_000,
        "turnDeadline": 30_000,
        "expiresAt": None,
        "participants": [
            {"participantId": "north", "claimed": True, "connected": True, "reconnectDeadline": None},
            {"participantId": "south", "claimed": True, "connected": True, "reconnectDeadline": None},
        ],
        "outcome": None,
        "turn": match_envelope(),
    }
    disconnected = {
        **active,
        "participants": [
            {
                "participantId": "north",
                "claimed": True,
                "connected": False,
                "reconnectDeadline": 20_000,
            },
            {"participantId": "south", "claimed": True, "connected": True, "reconnectDeadline": None},
        ],
        "turn": resolved_turn,
    }
    completed = {
        **disconnected,
        "status": "completed",
        "outcome": {"winner": "north", "loser": "south", "reason": "disconnect"},
        # Network policy ended the room; its last reducer turn remains playing.
        "turn": resolved_turn,
    }
    responses = [
        {
            "queueId": "global.open",
            "ticketId": "request_1",
            "state": "waiting",
            "joinedAt": 0,
            "expiresAt": 1,
            "mapId": "arena-s1-1",
            "teamId": "playerbot-mica",
            "matchId": None,
            "participantId": None,
        },
        {
            "queueId": "global.open",
            "ticketId": "request_1",
            "state": "matched",
            "joinedAt": 0,
            "expiresAt": 1,
            "mapId": "arena-s1-1",
            "teamId": "playerbot-mica",
            "matchId": "m1",
            "participantId": "north",
        },
        active,
        match_envelope(
            "pending",
            submittedParticipants=["north"],
            awaitingParticipants=["south"],
        ),
        resolved_turn,
        {**active, "turn": resolved_turn},
        disconnected,
        completed,
    ]
    calls = []
    client = ArenaClient("https://example.test", "ak_player")

    def fake_call(method, path, body=None):
        calls.append((method, path, body))
        return responses.pop(0)

    client._call = fake_call  # type: ignore[method-assign]
    client.join_arena_queue("arena-s1-1", "playerbot-mica", request_id="request_1")
    ticket = client.arena_queue_ticket("global.open", "request_1")
    assert ticket["state"] == "matched"
    assert ticket["matchId"] == "m1"
    client.connect_arena_match("m1")
    pending = client.submit_arena_intent("m1", {"id": "Action 1"}, "north-0")
    assert pending["kind"] == "pending"
    resolved = client.get_arena_turn_envelope("m1")
    assert resolved["kind"] == "turn"
    assert resolved["revision"] == 1
    client.heartbeat_arena_match("m1")
    disconnected_room = client.disconnect_arena_match("m1")
    assert disconnected_room["participants"][0]["connected"] is False
    assert disconnected_room["participants"][0]["reconnectDeadline"] == 20_000
    room = client.get_arena_room("m1")
    assert room["outcome"] == {"winner": "north", "loser": "south", "reason": "disconnect"}
    assert room["turn"]["turn"]["status"] == "playing"
    assert [call[1] for call in calls] == [
        "/v1/arena/matchmaking",
        "/v1/arena/matchmaking/global.open/request_1",
        "/v1/arena/matches/m1/presence",
        "/v1/arena/matches/m1/actions",
        "/v1/arena/matches/m1/turn",
        "/v1/arena/matches/m1/presence",
        "/v1/arena/matches/m1/presence",
        "/v1/arena/matches/m1",
    ]
    assert calls[3][2] == {
        "protocol": "agilabs.turns",
        "protocolVersion": "1.0",
        "sessionId": "m1",
        "turnId": "m1:0",
        "revision": 0,
        "participantId": "north",
        "submissionId": "north-0",
        "command": {"id": "Action 1"},
        "extensions": {"agilabs.arena": {"controlRevision": 0}},
    }
    assert calls[0][2] == {
        "mapId": "arena-s1-1",
        "teamId": "playerbot-mica",
        "requestId": "request_1",
    }
    assert calls[2][2] == {"connected": True}
    assert calls[5][2] == {"connected": True}
    assert calls[6][2] == {"connected": False}


def test_cancels_waiting_arena_ticket():
    waiting = {
        "queueId": "global.open",
        "ticketId": "request_2",
        "state": "waiting",
        "joinedAt": 0,
        "expiresAt": 1,
        "mapId": "arena-s1-1",
        "teamId": "fixer-overseer",
        "matchId": None,
        "participantId": None,
    }
    responses = [waiting, {**waiting, "state": "cancelled"}]
    calls = []
    client = ArenaClient("https://example.test", "ak_player")

    def fake_call(method, path, body=None):
        calls.append((method, path, body))
        return responses.pop(0)

    client._call = fake_call  # type: ignore[method-assign]
    client.join_arena_queue("arena-s1-1", "fixer-overseer", request_id="request_2")
    cancelled = client.cancel_arena_queue_ticket("global.open", "request_2")
    assert cancelled["state"] == "cancelled"
    assert calls[1] == (
        "DELETE",
        "/v1/arena/matchmaking/global.open/request_2",
        None,
    )


def test_arena_turn_poll_does_not_invent_a_solo_seat_binding():
    turn = {**envelope(), "sessionId": "m1", "turnId": "m1:0"}
    room = {
        "matchId": "m1",
        "sessionId": "m1",
        "status": "active",
        "participantId": "south",
        "readyDeadline": 120_000,
        "turnDeadline": 30_000,
        "expiresAt": None,
        "participants": [],
        "outcome": None,
        "turn": turn,
    }
    pending = {
        **turn,
        "kind": "pending",
        "submittedParticipants": ["south"],
        "awaitingParticipants": ["north"],
    }
    responses = [turn, room, pending]
    calls = []
    client = ArenaClient("https://example.test", "ak_player")

    def fake_call(method, path, body=None):
        calls.append((method, path, body))
        return responses.pop(0)

    client._call = fake_call  # type: ignore[method-assign]
    client.get_arena_turn_envelope("m1")
    client.submit_arena_intent("m1", {"id": "Action 8"}, "south-0")

    assert [call[1] for call in calls] == [
        "/v1/arena/matches/m1/turn",
        "/v1/arena/matches/m1",
        "/v1/arena/matches/m1/actions",
    ]
    assert calls[2][2]["participantId"] == "south"


def test_arena_same_world_control_steps_get_distinct_retry_keys():
    def match_envelope(control_revision):
        value = envelope()
        value["sessionId"] = "m1"
        value["turnId"] = "m1:0"
        value["turn"] = {**TURN, "controlRevision": control_revision}
        return value

    active = {
        "matchId": "m1",
        "sessionId": "m1",
        "status": "active",
        "participantId": "north",
        "readyDeadline": 120_000,
        "turnDeadline": 30_000,
        "expiresAt": None,
        "participants": [],
        "outcome": None,
        "turn": match_envelope(0),
    }
    responses = [active, match_envelope(1), match_envelope(2)]
    calls = []
    client = ArenaClient("https://example.test", "ak_player")

    def fake_call(method, path, body=None):
        calls.append((method, path, body))
        return responses.pop(0)

    client._call = fake_call  # type: ignore[method-assign]
    client.connect_arena_match("m1")
    client.submit_arena_intent("m1", {"id": "Action 6"})
    client.submit_arena_intent("m1", {"id": "Action 7", "index": 0})

    assert calls[1][2]["submissionId"] == "north:m1:0:control:0"
    assert calls[1][2]["extensions"] == {
        "agilabs.arena": {"controlRevision": 0}
    }
    assert calls[2][2]["submissionId"] == "north:m1:0:control:1"
    assert calls[2][2]["extensions"] == {
        "agilabs.arena": {"controlRevision": 1}
    }
    with pytest.raises(ProtocolMismatchError):
        client.submit_arena_intent(
            "m1", {"id": "Action 8"}, control_revision=9_007_199_254_740_992
        )
