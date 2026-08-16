"""Stage 7: per-record logging + final summary, per
data_normalisation_plan.txt section 12."""
import datetime
import os
from collections import defaultdict

OUTCOMES = ("imported", "updated", "unchanged", "skipped", "malformed", "unsupported", "error")


class Report:
    def __init__(self, log_dir: str):
        os.makedirs(log_dir, exist_ok=True)
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.log_path = os.path.join(log_dir, f"import_{ts}.log")
        self._fh = open(self.log_path, "w", encoding="utf-8")
        self.counts = defaultdict(lambda: defaultdict(int))
        self.raw_ingest_counts = defaultdict(lambda: defaultdict(int))
        self.asset_stats = defaultdict(int)
        self.start_time = datetime.datetime.now()

    def record(self, entity_type: str, source: str, name: str, outcome: str, reason: str = ""):
        self.counts[entity_type][outcome] += 1
        line = f"{entity_type}\t{source}\t{name}\t{outcome}"
        if reason:
            line += f"\t{reason}"
        self._fh.write(line + "\n")

    def record_raw(self, entity_type: str, outcome: str):
        self.raw_ingest_counts[entity_type][outcome] += 1

    def record_asset(self, kind: str):
        self.asset_stats[kind] += 1

    def summary_lines(self):
        elapsed = datetime.datetime.now() - self.start_time
        lines = []
        lines.append(f"WorldWatcher importer run summary - {datetime.datetime.now().isoformat()}")
        lines.append(f"Wall-clock time: {elapsed}")
        lines.append("")
        lines.append("-- Stage 2 (raw ingest, always) --")
        for et in sorted(self.raw_ingest_counts):
            parts = ", ".join(f"{k}={v}" for k, v in sorted(self.raw_ingest_counts[et].items()))
            lines.append(f"  {et}: {parts}")
        lines.append("")
        lines.append("-- Stage 4 (relational projection) --")
        for et in sorted(self.counts):
            parts = " ".join(f"{o}={self.counts[et].get(o, 0)}" for o in OUTCOMES)
            lines.append(f"  {et}: {parts}")
        lines.append("")
        lines.append("-- Stage 5 (assets) --")
        for k in sorted(self.asset_stats):
            lines.append(f"  {k}: {self.asset_stats[k]}")
        return lines

    def finish(self):
        summary = self.summary_lines()
        self._fh.write("\n" + "\n".join(summary) + "\n")
        self._fh.close()
        return summary
