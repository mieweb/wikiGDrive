## Data Migration Workflow Considerations <a id="_ijrry6m0ogyn"></a>

As we may recall, the Health Surveillance module allows users to easily track and manage overall health for risk groups and patient populations. Following that is information on how to utilize the import/export tools available with every {{% system-name %}} system.

### Strategies for Migrating Legacy Health Surveillance Data

Health Surveillance (HS) Data is typically broken down into 4 parts during the data migration process:

1. Active HS Memberships and Next Due Dates
2. Historical HS Memberships

#### Active HS Memberships and Next Due Dates <a id="_s7i4qlvtmo84"></a>

Nearly every {{% sys-name %}} data migration involves the migration of active HS memberships and Next Due Dates. Membership inclusions and exclusions may be explicit or implicit depending on the configuration of each panel, and those decisions will all weigh into the scoping of the data migration.

**Historical HS Memberships**

Some clients require the migration of historical, or non-active HS memberships. There are two possible migration tactics that should be considered in these cases:

1. Discrete data migration of Historical HS Memberships involves migrating memberships with a Begin and End Date for each employee's expired panel. Discrete migrations such as these require mapping each legacy panel membership to {{% sys-name %}} panels, which will then allow for the reporting of historical panel memberships and dates, per employee.
2. Non-Discrete summary documents of historical HS memberships provide a single document showing the legacy name of the panel for each chart with HS memberships, along with the start- and end-dates where that data is available. These documents are significantly less effort than discrete data migrations of historical HS memberships, and allow clinicians to reference the historical entry and exit data of an employee's memberships.

#### Open Orders <a id="_8sdu26gx33vo"></a>

In some cases, open or pending orders are required for migration for employees with overdue but active panel memberships. This use case is discussed further in the section on [How to determine the Next Due Date on a HS Panel](#how-to-determine-the-next-due-date-on-a-hs-panel).

#### Historical Orders <a id="_myh1j29r0obc"></a>

In some cases, migration of completed orders are required to show that tests or tasks were completed on a particular date. Like any other data migration, discrete migration of historical orders involves more mapping and more effort than creating a summary document of historical orders. The following use cases are most common where the migration of historical orders are needed:

### UL/OHM-Specific Overview for Migrating Legacy Health Surveillance Data

Over the years {{% system-name %}} has completed many data migrations from OHM. Through this process our team has built a series of tools to allow us to convert this data quickly and easily. The following outlines the types of data, modules, and storage we consider for the migration. Consider the storage type needed for the data being migrated, as well as the mapping that may be required when pursuing efforts of discrete data, specifically. Note the table names in parentheses utilized for each module.
