## Request <a id="_muaembvwg7up"></a>

{{% pre language="html" theme="RDark" %}}
```

https://webchartnow.com/fhirr4sandbox/webchart.cgi/fhir/CarePlan/11

```
{{% /pre %}}

## Response <a id="_5e5g45ahhwrd"></a>

{{% pre language="json" theme="RDark" %}}
```

{
	"resourceType": "CarePlan",
	"id": "11",
	"subject": {
		"reference": "Patient/18",
		"type": "Patient",
		"display": "William S. Hart"
	},
	"category": [
		{
			"coding": [
				{
					"system": "http://hl7.org/fhir/us/core/CodeSystem/careplan-category",
					"code": "assess-plan"
				}
			],
			"text": "AssessPlan"
		}
	],
	"intent": "order",
	"text": {
		"status": "additional",
		"div": "<div xmlns=\"http://www.w3.org/1999/xhtml\">No narrative provided for encounter 11</div>"
	},
	"status": "completed"
}

```
{{% /pre %}}
