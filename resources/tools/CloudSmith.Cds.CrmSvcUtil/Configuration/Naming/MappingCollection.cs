﻿namespace CloudSmith.Cds.CrmSvcUtil.Configuration.Naming
{
    public class MappingCollection : MapConfigurationElementCollection<Map>
    {
        /// <inheritdoc />
        protected override object GetElementKey(Map element)
        {
            return element.From;
        }
    }
}