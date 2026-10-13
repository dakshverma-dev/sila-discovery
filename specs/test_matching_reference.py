import copy, json, unittest
from pathlib import Path
from matching_reference import required_seats, rank_utility, solve, ready
F=json.loads(Path(__file__).with_name("synthetic_fixture.json").read_text())
class ReferenceChecks(unittest.TestCase):
    def test_quote_and_surplus(self):
        self.assertEqual(required_seats(F["quote"],30),24)
        r=solve(F); self.assertEqual(len(r),1)
        self.assertEqual(r[0]["planned_seats"],25)
        self.assertEqual(r[0]["surplus_pence"],2500)
    def test_unaffordable_and_capacity(self):
        f=copy.deepcopy(F); f["groups"][0]["budget_pence"]=1000
        self.assertEqual(solve(f),[])
        f=copy.deepcopy(F); f["slot"]["capacity"]=23
        self.assertEqual(solve(f),[])
    def test_time_and_access(self):
        f=copy.deepcopy(F); f["groups"][0]["availability"]=[]
        self.assertEqual(solve(f),[])
        f=copy.deepcopy(F); f["experience"]["access_support"]=["seating"]
        self.assertEqual(solve(f),[])
    def test_sharing_and_unknown(self):
        f=copy.deepcopy(F); f["groups"][0]["sharing_consent"]=False
        self.assertEqual(solve(f),[])
        f=copy.deepcopy(F); f["synthetic_ranked_anchor_labels"]["group_a"]=[]
        self.assertEqual(solve(f)[0]["status"],"NEEDS_REVIEW")
    def test_rank_and_withdrawal(self):
        self.assertEqual(rank_utility(["a"],["a"]),.5)
        self.assertIsNone(rank_utility(["a"],["b"]))
        self.assertTrue(ready([True,True,True],24,24,30))
        self.assertFalse(ready([True,True,True],23,24,30))
        self.assertFalse(ready([True,False,True],25,24,30))
        self.assertFalse(ready([True,True,True],25,24,30,before_deadline=False))
    def test_caps_and_zero_margin(self):
        q=copy.deepcopy(F["quote"]); q["ticket_pence"]=700
        self.assertIsNone(required_seats(q,30))
        q=dict(fixed_pence=0,variable_pence=0,minimum_venue_charge_pence=0,platform_fee_pence=0,ticket_pence=0,venue_min_seats=2)
        self.assertEqual(required_seats(q,30),2)
        f=copy.deepcopy(F); f["groups"]=f["groups"]*7
        with self.assertRaises(ValueError):solve(f)
if __name__=="__main__":unittest.main()
