package com.scrollsguide.bot.trade;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class TradeMessage {

	public static enum CUR {
		NONE, BUY, SELL
	};

	private static HashMap<String, ArrayList<Scroll>> hashLink;

	private final String[] split;

	private final Pattern pricePattern = Pattern.compile("[0-9]+");
	// unused atm, make sure this works at some point
	private final Pattern priceKPattern = Pattern.compile("[0-9]+(.[0-9]+)?k");

	private static final ArrayList<String> SELL = new ArrayList<String>(Arrays.asList(new String[] { "wts", "selling",
			"sell" }));
	private static final ArrayList<String> BUY = new ArrayList<String>(Arrays.asList(new String[] { "wtb", "buying",
			"buy" }));

	private TradeScrollList tsl = new TradeScrollList();

	public static void makeCardMap(JSONArray cardTypes) {
		hashLink = new HashMap<String, ArrayList<Scroll>>();

		for (int i = 0; i < cardTypes.length(); i++) {
			try {
				JSONObject s = cardTypes.getJSONObject(i);

				Scroll scroll = new Scroll(s.getInt("id"), s.getString("name"));

				// this gets rid of the ' as well so caller's bane -> callers bane
				String[] nameSplit = s.getString("name").toLowerCase().replaceAll("[^a-z ]", "").split(" ");

				for (String splitted : nameSplit) {
					if (!hashLink.containsKey(splitted)) {
						hashLink.put(splitted, new ArrayList<Scroll>());
					}

					hashLink.get(splitted).add(scroll);
				}
			} catch (JSONException e) {
				e.printStackTrace();
			}
		}

		// remove nondescriptive/too generic words
		hashLink.remove("and");
		hashLink.remove("new");
		hashLink.remove("of");
		hashLink.remove("the");
		hashLink.remove("to"); // damn return to nature
	}

	public TradeMessage(String txt) {
		// first replace is for caller's bane -> callers bane
		split = txt.toLowerCase().replace("'", "").replaceAll("[^a-z0-9. ]", " ").split(" ");
		// the replace with space is crucial here for typos etc.

		this.parse();
	}

	private boolean parsePrice(String word) {
		Matcher m = pricePattern.matcher(word);

		if (m.find()) {
			String price = m.group();

			// we can assume parsing the int doesn't throw an exception because it's matched
			// to nothing but integers [0-9]+
			int p = Integer.parseInt(price);

			// if it's less than 50 it's probably an amount of scrolls eg. wts 5 golem, so skip those
			if (p >= 50) {
				tsl.pricePrevious(p);
			}
			return true;
		}
		return false;
	}

	private Scroll firstPass(ArrayList<Scroll> possibles) {
		// don't return energy siphon because of 'selling variety of energy scrolls' type of messages
		if (possibles.size() == 1 && !isEdgeCase(possibles.get(0), "Energy Siphon")) {
			return possibles.get(0);
		}
		// no immediate match found
		return null;
	}

	// union of two arrays, only returns when it's a single element
	private <T> T union(ArrayList<T> possibles, ArrayList<T> p2) {
		for (int k = 0; k < possibles.size(); k++) {
			boolean in = p2.contains(possibles.get(k));

			if (!in) {
				possibles.remove(k);
				k--;
			}
		}

		if (possibles.size() == 1) {
			return possibles.get(0);
		}
		return null;
	}

	private boolean isEdgeCase(Scroll s, String edge) {
		return s.getName().equals(edge);
	}

	private Scroll filterEdgeCase(ArrayList<Scroll> possibles, String edge) {
		for (int k = 0; k < possibles.size(); k++) {
			if (isEdgeCase(possibles.get(k), edge)) {
				// yep, this is an edge case
				return possibles.get(k);
			}
		}
		return null;
	}

	private void parse() {
		CUR current = CUR.NONE;
		int skip = 0;
		for (int i = 0; i < split.length; i++) {
			if (SELL.contains(split[i])) {
				// check for wtb before wts and finalize wtb
				if (current == CUR.BUY) {
					tsl.finalizeSoFar();
				}

				current = CUR.SELL;
			} else if (BUY.contains(split[i])) {
				// check for wts before wtb and finalize wts
				if (current == CUR.SELL) {
					tsl.finalizeSoFar();
				}

				current = CUR.BUY;
			} else if (current != CUR.NONE) {
				// check for price first, if no match then check for scroll
				if (!parsePrice(split[i])) {
					// maybe it's a scroll, then?

					if (hashLink.containsKey(split[i])) {
						// possible scroll detected

						ArrayList<Scroll> possibles = new ArrayList<Scroll>(hashLink.get(split[i]));

						Scroll definite = firstPass(possibles);

						if (definite == null) { // first pass resulted in nothing
							boolean foundScroll = false;

							int skip2 = 2;
							for (int j = i + 1; j < i + skip2 && j < split.length && !foundScroll; j++) {
								// skip the generic words again, brother OF THE wolf makes no difference from brother wolf
								if (split[j].equals("of")) {
									skip2++;
								} else if (split[j].equals("the")) {
									skip2++;
								}

								if (hashLink.containsKey(split[j])) {
									ArrayList<Scroll> p2 = hashLink.get(split[j]);

									// now we have two (hopefully) overlapping arrays of scrolls
									// from which the union of both arrays is hopefully a single element
									// if it's not a single element, note that possibles is passed by
									// reference so that array will be smaller next pass so we
									// hopefully _will_ find a match eventually
									definite = union(possibles, p2);

									if (definite != null) {
										skip = j - i;
										foundScroll = true;
									}
								}
							}
						}

						// still no scroll found
						// check for edge case Owl as it would match Sister Owl as well
						definite = filterEdgeCase(possibles, "Owl");

						if (definite != null) {
							tsl.add(new TradeScroll(definite, current));
						}
					}
				}
			}
			i += skip;
			skip = 0;
		}
	}

	public TradeScrollList getTradeScrollList() {
		return this.tsl;
	}

	public class TradeScrollList extends ArrayList<TradeScroll> {

		public void pricePrevious(int p) {

			boolean done = false;

			for (int i = size() - 1; i >= 0 && !done; i--) {
				TradeScroll t = get(i);

				if (t.getPrice() == TradeScroll.NO_PRICE) {
					t.setPrice(p);
				} else {
					done = true;
				}
			}
		}

		// finalizes the trades for the scrolls so the price can't be changed anymore
		public void finalizeSoFar() {
			for (TradeScroll ts : this) {
				ts.makeFinal();
			}
		}

		@Override
		public boolean add(TradeScroll s) {
			boolean contains = false;

			// how to do this easier... super.contains(s) ? :p
			// oh well
			for (int i = 0; i < size() && !contains; i++) {
				contains |= get(i).getScroll().equals(s.getScroll());
			}

			if (!contains) {
				super.add(s);
			}
			return true;
		}

		@Override
		public String toString() {
			StringBuilder out = new StringBuilder();
			for (int i = 0; i < size(); i++) {
				out.append(i + ": " + get(i).toString() + "\n");
			}
			return out.toString();
		}
	}

	public class Scroll {

		private final int id;
		private final String name;

		public Scroll(int id, String name) {
			this.id = id;
			this.name = name;
		}

		public String getName() {
			return this.name;
		}

		public int getId() {
			return this.id;
		}

		@Override
		public String toString() {
			return this.getId() + ": " + this.getName();
		}
	}
	
	public class TradeScroll {
		private final Scroll scroll;
		private final CUR type;

		private boolean finalized = false;

		public static final int NO_PRICE = -1;
		private int price = NO_PRICE;

		public TradeScroll(Scroll scroll, CUR type) {
			this.scroll = scroll;
			this.type = type;
		}

		// sets this scroll in stone making it so that the price can't change anymore
		public void makeFinal() {
			this.finalized = true;
		}

		@Override
		public String toString() {
			String t = type == CUR.BUY ? "BUYING " : "SELLING ";
			return t + price + " " + scroll.toString();
		}

		public void setPrice(int price) {
			if (!finalized) {
				this.price = price;
			}
		}

		public int getPrice() {
			return price;
		}

		public Scroll getScroll() {
			return scroll;
		}

		public CUR getType() {
			return type;
		}
	}
}
