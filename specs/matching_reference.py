"""Synthetic design reference. No API calls, user data, payment or booking writes."""
from itertools import combinations
from datetime import datetime

def required_seats(quote, capacity):
    for n in range(quote["venue_min_seats"], capacity + 1):
        venue=max(quote["fixed_pence"] + quote["variable_pence"] * n,
                  quote["minimum_venue_charge_pence"])
        cost=venue + quote["platform_fee_pence"] * n
        if quote["ticket_pence"] * n >= cost:
            return n
    return None

def rank_utility(anchor_labels, ranked_labels, universe=None):
    if not ranked_labels or len(set(ranked_labels)) != len(ranked_labels):
        return None
    if universe is not None and (len(universe) < 2 or set(ranked_labels) != set(universe)):
        return None
    n=len(ranked_labels)
    known=[a for a in anchor_labels if a in ranked_labels]
    if not known:
        return None
    scores=[0.5 if n == 1 else 1 - ranked_labels.index(a)/(n - 1) for a in known]
    return sum(scores)/len(scores)

def available(group, slot):
    start=datetime.fromisoformat(slot["start_at"].replace("Z","+00:00"))
    end=datetime.fromisoformat(slot["end_at"].replace("Z","+00:00"))
    return any(datetime.fromisoformat(w["start_at"].replace("Z","+00:00")) <= start
               and datetime.fromisoformat(w["end_at"].replace("Z","+00:00")) >= end
               for w in group["availability"])

def solve(fixture):
    groups=fixture["groups"]
    if len(groups) > 20:
        raise ValueError("Input cap exceeded")
    q=fixture["quote"]; slot=fixture["slot"]; exp=fixture["experience"]
    required=required_seats(q,slot["capacity"])
    if required is None:
        return []
    result=[]
    for size in range(2,min(4,len(groups))+1):
        for coalition in combinations(groups,size):
            seats=sum(g["expected_seats"] for g in coalition)
            feasible=required <= seats <= slot["capacity"] and all(
                g["sharing_consent"] and g["budget_pence"] >= q["ticket_pence"]
                and available(g,slot)
                and set(g["access_requirements"]).issubset(exp["access_support"])
                for g in coalition)
            if not feasible:
                continue
            utilities=[rank_utility(exp["anchor_labels"],fixture["synthetic_ranked_anchor_labels"].get(g["id"],[]),fixture["anchor_universe"]) for g in coalition]
            unknown=any(u is None for u in utilities)
            score=None if unknown else .7*min(utilities)+.3*sum(utilities)/len(utilities)
            cost=max(q["fixed_pence"]+q["variable_pence"]*seats,q["minimum_venue_charge_pence"])+q["platform_fee_pence"]*seats
            result.append({"group_ids":sorted(g["id"] for g in coalition),
                           "required_seats":required,"planned_seats":seats,
                           "score":score,"status":"NEEDS_REVIEW" if unknown else "DRAFT",
                           "surplus_pence":q["ticket_pence"]*seats-cost,
                           "source_mode":"synthetic","payment_status":"NOT_COLLECTED"})
    return sorted(result,key=lambda x:(x["score"] is None,-(x["score"] or 0),-x["surplus_pence"],x["group_ids"]))[:3]

def ready(accepted, active_seats, required, capacity, before_deadline=True, quote_current=True, slot_held=True):
    return all(accepted) and bool(accepted) and required <= active_seats <= capacity and before_deadline and quote_current and slot_held
