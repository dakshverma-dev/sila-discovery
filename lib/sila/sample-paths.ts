export const SAMPLE_SCREEN_PATHS = ["experiences","venue","venue/sessions","venue/sessions/new","venue/payments","venue/settings","plans","ops","ops/introductions","ops/activity","account","help","privacy","terms",
  ...["print-room","woodcut","type-and-paper","botanical-print","autumn-prints","record"].flatMap(id=>[`s/${id}`,`s/${id}/clubs`,`s/${id}/request`,`venue/sessions/${id}`]),
  ...["meadows-print","leith-print","meadows-woodcut","leith-woodcut","meadows-type","leith-type","meadows-autumn","leith-autumn","record"].map(id=>`plans/${id}`)];
