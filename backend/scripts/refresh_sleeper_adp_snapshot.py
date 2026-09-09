import html
import json
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path


SOURCE_URL = (
    "https://hashtagfootball.com/"
    "fantasy-football-adp-sleeper"
)

POSITIONS = {
    "QB",
    "RB",
    "WR",
    "TE",
    "K",
    "DST",
}


class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()

        self.rows = []
        self.current_row = None
        self.current_cell = None

    def handle_starttag(
        self,
        tag,
        attrs,
    ):
        if tag == "tr":
            self.current_row = []

        elif (
            tag in {"td", "th"}
            and self.current_row
            is not None
        ):
            self.current_cell = []

    def handle_data(
        self,
        data,
    ):
        if self.current_cell is not None:
            self.current_cell.append(
                data
            )

    def handle_endtag(
        self,
        tag,
    ):
        if (
            tag in {"td", "th"}
            and self.current_cell
            is not None
        ):
            value = " ".join(
                " ".join(
                    self.current_cell
                ).split()
            )

            self.current_row.append(
                html.unescape(value)
            )

            self.current_cell = None

        elif (
            tag == "tr"
            and self.current_row
            is not None
        ):
            if self.current_row:
                self.rows.append(
                    self.current_row
                )

            self.current_row = None


def parse_float(value):
    try:
        return float(value)
    except (
        TypeError,
        ValueError,
    ):
        return None


def parse_int(value):
    try:
        return int(float(value))
    except (
        TypeError,
        ValueError,
    ):
        return None


request = urllib.request.Request(
    SOURCE_URL,
    headers={
        "User-Agent": (
            "Mozilla/5.0 "
            "(ThunderDraft personal "
            "fantasy draft assistant)"
        ),
        "Accept": (
            "text/html,"
            "application/xhtml+xml"
        ),
    },
)

print(
    "Downloading Sleeper Half-PPR ADP..."
)

with urllib.request.urlopen(
    request,
    timeout=30,
) as response:
    document = response.read().decode(
        "utf-8",
        errors="replace",
    )

print(
    "Downloaded:",
    len(document),
    "bytes",
)

parser = TableParser()
parser.feed(document)

players = []

for row in parser.rows:
    cells = [
        value.strip()
        for value in row
        if value.strip()
    ]

    if len(cells) < 6:
        continue

    position_index = None

    for index, value in enumerate(
        cells
    ):
        normalized = (
            value.upper()
            .replace("D/ST", "DST")
            .replace("DEF", "DST")
        )

        if (
            normalized in POSITIONS
            and index >= 1
        ):
            position_index = index
            break

    if position_index is None:
        continue

    name = cells[
        position_index - 1
    ]

    position = (
        cells[position_index]
        .upper()
        .replace("D/ST", "DST")
        .replace("DEF", "DST")
    )

    if (
        position_index + 4
        >= len(cells)
    ):
        continue

    team = cells[
        position_index + 1
    ].upper()

    rest = cells[
        position_index + 2:
    ]

    # Expected first Half-PPR group:
    #
    # ADP | ORDER | POSITION RANK
    #
    # Example:
    # 3.8 | 3 | WR1
    if len(rest) < 3:
        continue

    adp = parse_float(
        rest[0]
    )

    order = parse_int(
        rest[1]
    )

    position_rank_text = (
        rest[2]
        .upper()
        .replace("D/ST", "DST")
        .replace("DEF", "DST")
    )

    match = re.fullmatch(
        r"(QB|RB|WR|TE|K|DST)(\d+)",
        position_rank_text,
    )

    if (
        adp is None
        or order is None
        or match is None
    ):
        continue

    position_rank = int(
        match.group(2)
    )

    players.append(
        {
            "name": name,
            "position": position,
            "team": team,
            "adp": adp,
            "order": order,
            "positionRank":
                position_rank,
        }
    )


# Deduplicate on overall Sleeper order.
unique = {}

for player in players:
    unique[
        player["order"]
    ] = player

players = [
    unique[order]
    for order in sorted(unique)
]


if len(players) < 150:
    raise RuntimeError(
        "Only parsed "
        f"{len(players)} players. "
        "Refusing to overwrite the "
        "existing snapshot."
    )


orders = [
    player["order"]
    for player in players
]

if len(orders) != len(set(orders)):
    raise RuntimeError(
        "Duplicate Sleeper draft "
        "orders detected."
    )


chase = next(
    (
        player
        for player in players
        if player["name"]
        == "Ja'Marr Chase"
    ),
    None,
)

if chase is None:
    raise RuntimeError(
        "Ja'Marr Chase was not found."
    )


cache_file = (
    Path(__file__)
    .resolve()
    .parents[1]
    / "data"
    / "cache"
    / "sleeper_2026_half_ppr_adp.json"
)

cache_file.parent.mkdir(
    parents=True,
    exist_ok=True,
)

payload = {
    "source": SOURCE_URL,
    "scoringFormat":
        "half-ppr",
    "fetchedAt":
        datetime.now(
            timezone.utc,
        ).isoformat(),
    "playerCount":
        len(players),
    "players":
        players,
}

temporary = cache_file.with_suffix(
    ".tmp"
)

temporary.write_text(
    json.dumps(
        payload,
        indent=2,
    ),
    encoding="utf-8",
)

temporary.replace(
    cache_file
)


print()
print(
    "Parsed players:",
    len(players),
)

print(
    "Snapshot:",
    cache_file,
)

print()
print(
    "===== TOP 25 SLEEPER HALF-PPR ====="
)

for player in players[:25]:
    print(
        f"#{player['order']:<3} "
        f"{player['name']:<25} "
        f"{player['position']}"
        f"{player['positionRank']:<3} "
        f"{player['team']:<4} "
        f"ADP {player['adp']}"
    )

print()
print(
    "===== CHASE CHECK ====="
)

print(chase)

if (
    chase["position"] != "WR"
    or chase[
        "positionRank"
    ] != 1
):
    raise RuntimeError(
        "Ja'Marr Chase is not WR1 "
        "in this snapshot. "
        "Do not deploy it."
    )

print()
print(
    "Snapshot validation PASSED."
)
