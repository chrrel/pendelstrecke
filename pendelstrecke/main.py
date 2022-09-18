import csv
import json
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any, List

import yaml
from vvspy import get_trip


def get_stations(file_path: str) -> List[dict]:
	"""Load data for all stations from a CSV file."""
	with open(file_path, newline="", encoding="ISO-8859-1") as csvfile:
		reader = csv.DictReader(csvfile, delimiter=";")
		return list(reader)


def get_station_by_id(global_id: str, stations: List[dict]) -> dict:
	"""Get data about a station from the list of stations"""
	return next((station for station in stations if station["Globale ID"] == global_id), {})


def get_trip_for_station(origin_station: dict, destination_station_id: str, trip_date: datetime) -> dict:
	"""Load data for a trip using the VVS API."""
	try:
		trip = get_trip(origin_station["Globale ID"], destination_station_id, check_time=trip_date)
		logging.info(trip)
		return {
			"station": origin_station,
			"duration": trip.duration / 60,
			"changes": len(trip.connections) - 1,
			"transportation": [connection.transportation.disassembled_name for connection in trip.connections],
		}
	except Exception as e:
		logging.info(f"Error at {origin_station['#Name']}: {e}")
		return {
			"station": origin_station,
			"duration": -1,
			"changes": 0,
			"transportation": [],
		}


def get_trip_for_stations(origin_stations: List[dict], destination_station_id: str, trip_date: datetime) -> List[dict]:
	"""Load data for trips from all origin stations using the VVS API."""
	def _helper(origin_station: dict):
		return get_trip_for_station(origin_station, destination_station_id, trip_date)

	results = []
	with ThreadPoolExecutor(max_workers=8) as executor:
		# Wrap in a list() to wait for all requests to complete
		for result in list(executor.map(_helper, origin_stations)):
			results.append(result)
	return results


def write_to_json_file(data: Any, file_name: str) -> None:
	with open(file_name, "w", encoding="utf-8") as f:
		json.dump(data, f, ensure_ascii=False, indent=4)


def write_to_js_file(data: Any, file_name: str) -> None:
	with open(file_name, "w", encoding="utf-8") as f:
		f.write("var itemgroups =" + json.dumps(data, ensure_ascii=False, indent=4) + ";")


def main():
	with open("config.yaml", "r") as c:
		config = yaml.safe_load(c)

	# Get all stations
	stations = get_stations(config["station_data_path"])
	logging.info(f"[+] Found {len(stations)} stations")

	# Limit to stations in given fare zones
	origin_stations = [s for s in stations if any(zone in s["Tarifzonen"].split(",") for zone in config["fare_zones"])]
	logging.info(f"[+] Limited search to {len(origin_stations)} stations")

	# Load data for trips to each destination station
	start_time = time.time()
	all_results = []
	for destination_station_id in config["destination_stations"]:
		destination = get_station_by_id(destination_station_id, stations)
		results = {
			"destination": {
				"id": destination_station_id,
				"name": destination["#Name"],
				"coordinates": [destination["Y-Koordinate"].replace(",", "."), destination["X-Koordinate"].replace(",", ".")]
			},
			"stations": get_trip_for_stations(origin_stations, destination_station_id, config["trip_date"])
		}
		all_results.append(results)
	logging.info(f"[+] Needed {time.time() - start_time} seconds to fetch data")

	# Store results as JSON and as JS for HTML map
	write_to_json_file(all_results, config["json_data_path"])
	write_to_js_file(all_results, config["js_data_path"])


if __name__ == "__main__":
	logging.basicConfig(level=logging.INFO)
	main()
