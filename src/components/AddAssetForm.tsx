import React, { useState } from 'react';
import { X, Building, MapPin, Shield, Users, Settings, AlertTriangle, Save, Loader2, Brain } from 'lucide-react';
import { Database } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import MitigationSelector from './MitigationSelector';
import { AppliedMitigation } from '../types/mitigation';
import { aiService } from '../services/aiService';

type AssetInsert = Database['public']['Tables']['assets']['Insert'];

interface AddAssetFormProps {
  onClose: () => void;
  onSubmit: (data: AssetInsert) => Promise<void>;
}

const AddAssetForm: React.FC<AddAssetFormProps> = ({ onClose, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiScoring, setAiScoring] = useState(false);
  const { profile } = useAuth();
  const [mitigations, setMitigations] = useState<AppliedMitigation[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'building' as const,
    location: {
      address: '',
      city: '',
      country: '',
      coordinates: [0, 0] as [number, number]
    },
    status: 'secure' as const,
    personnel: {
      current: 0,
      capacity: 0,
      authorized: [] as string[]
    },
    ai_risk_score: {
      overall: 25,
      components: {
        physicalSecurity: 20,
        cyberSecurity: 30,
        accessControl: 15,
        environmentalRisk: 25,
        personnelRisk: 20
      },
      trend: 'stable' as const,
      lastUpdated: new Date().toISOString(),
      confidence: 85,
      predictions: {
        nextWeek: 26,
        nextMonth: 24
      }
    },
    security_systems: {
      cctv: { status: 'online' as const, coverage: 90 },
      accessControl: { status: 'online' as const, zones: 5 },
      alarms: { status: 'online' as const, sensors: 20 },
      fireSupression: { status: 'online' as const, coverage: 100 },
      networkSecurity: { status: 'online' as const, threats: 0 }
    },
    compliance: {
      lastAudit: new Date().toISOString().split('T')[0],
      nextAudit: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      score: 90,
      issues: [] as string[]
    },
    incidents: {
      total: 0,
      lastIncident: 'None',
      severity: 'low' as const
    },
    responsible_officer: {
      name: '',
      email: '',
      phone: '',
      department: ''
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!formData.name || !formData.location.city || !formData.location.country || !formData.responsible_officer.name) {
        throw new Error('Please fill in all required fields');
      }

      // Prepare asset data for AI risk scoring
      const assetData = {
        organization_id: profile?.organization_id || '',
        name: formData.name,
        type: formData.type,
        location: formData.location,
        status: formData.status,
        personnel: formData.personnel,
        security_systems: formData.security_systems,
        compliance: formData.compliance,
        incidents: formData.incidents,
        responsible_officer: formData.responsible_officer
      };

      // Set AI scoring state to show loading indicator
      setAiScoring(true);

      // Call AI service to get risk score
      let aiRiskScore = { ...formData.ai_risk_score };
      
      try {
        const aiResult = await aiService.scoreAssetRisk(assetData);
        
        // Update risk score with AI-calculated values
        aiRiskScore = {
          overall: aiResult.score,
          components: aiResult.components || aiRiskScore.components,
          trend: (aiResult.trend as 'improving' | 'stable' | 'deteriorating') || 'stable',
          lastUpdated: new Date().toISOString(),
          confidence: aiResult.confidence,
          predictions: aiResult.predictions || {
            nextWeek: Math.round(aiResult.score * (1 + (Math.random() * 0.1 - 0.05))),
            nextMonth: Math.round(aiResult.score * (1 + (Math.random() * 0.2 - 0.1)))
          },
          explanation: aiResult.explanation
        };
      } catch (aiError) {
        console.error('Error getting AI risk score:', aiError);
        // Continue with default risk score if AI scoring fails
      } finally {
        setAiScoring(false);
      }
      
      // Calculate effective risk score based on mitigations
      const totalRiskReduction = mitigations.reduce(
        (sum, mitigation) => sum + mitigation.applied_risk_reduction_score, 
        0
      );
      
      // Ensure risk score doesn't go below 0
      const effectiveRiskScore = Math.max(0, aiRiskScore.overall - totalRiskReduction);
      
      // Update the risk score with the effective value
      const updatedRiskScore = {
        ...aiRiskScore,
        overall: effectiveRiskScore,
        mitigationApplied: totalRiskReduction > 0,
        originalScore: aiRiskScore.overall,
        totalRiskReduction
      };

      const finalAssetData: AssetInsert = {
        organization_id: profile?.organization_id || '',
        name: formData.name,
        type: formData.type,
        location: formData.location,
        status: formData.status,
        personnel: formData.personnel,
        ai_risk_score: updatedRiskScore,
        security_systems: formData.security_systems,
        compliance: formData.compliance,
        incidents: formData.incidents,
        responsible_officer: formData.responsible_officer,
        mitigations: mitigations.length > 0 ? mitigations : null
      };

      await onSubmit(finalAssetData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add asset');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (path: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev };
      const keys = path.split('.');
      let current = newData;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const assetTypes = [
    { value: 'building', label: 'Building' },
    { value: 'facility', label: 'Facility' },
    { value: 'vehicle', label: 'Vehicle' },
    { value: 'equipment', label: 'Equipment' },
    { value: 'data-center', label: 'Data Center' },
    { value: 'embassy', label: 'Embassy' }
  ];

  const countries = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo (Brazzaville)',
  'Congo (Kinshasa)',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czech Republic',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Ivory Coast',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe'
];

  const departments = [
    'Security Operations',
    'Field Operations',
    'Transport Security',
    'IT Security',
    'Physical Security',
    'Data Security',
    'Executive',
    'Operations'
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add New Asset</h2>
                <p className="text-gray-600">Enter asset details and security information</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Building className="w-5 h-5 text-blue-500" />
              <span>Basic Information</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asset Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter asset name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Asset Type *
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => updateFormData('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {assetTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => updateFormData('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="secure">Secure</option>
                  <option value="alert">Alert</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="offline">Offline</option>
                  <option value="compromised">Compromised</option>
                </select>
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-green-500" />
              <span>Location Information</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location.address}
                  onChange={(e) => updateFormData('location.address', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter street address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location.city}
                  onChange={(e) => updateFormData('location.city', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter city"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country *
                </label>
                <select
                  required
                  value={formData.location.country}
                  onChange={(e) => updateFormData('location.country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Country</option>
                  {countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.location.coordinates[1]}
                    onChange={(e) => updateFormData('location.coordinates', [formData.location.coordinates[0], parseFloat(e.target.value) || 0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="40.7128"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formData.location.coordinates[0]}
                    onChange={(e) => updateFormData('location.coordinates', [parseFloat(e.target.value) || 0, formData.location.coordinates[1]])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="-74.0060"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Personnel Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span>Personnel Information</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Personnel
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.personnel.current}
                  onChange={(e) => updateFormData('personnel.current', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Personnel Capacity
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.personnel.capacity}
                  onChange={(e) => updateFormData('personnel.capacity', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Responsible Officer */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Shield className="w-5 h-5 text-red-500" />
              <span>Responsible Officer</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Officer Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.responsible_officer.name}
                  onChange={(e) => updateFormData('responsible_officer.name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter officer name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.responsible_officer.email}
                  onChange={(e) => updateFormData('responsible_officer.email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="officer@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.responsible_officer.phone}
                  onChange={(e) => updateFormData('responsible_officer.phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1-555-0123"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department *
                </label>
                <select
                  required
                  value={formData.responsible_officer.department}
                  onChange={(e) => updateFormData('responsible_officer.department', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Security Systems */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Settings className="w-5 h-5 text-orange-500" />
              <span>Security Systems</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CCTV Coverage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.security_systems.cctv.coverage}
                  onChange={(e) => updateFormData('security_systems.cctv.coverage', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Control Zones
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.security_systems.accessControl.zones}
                  onChange={(e) => updateFormData('security_systems.accessControl.zones', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alarm Sensors
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.security_systems.alarms.sensors}
                  onChange={(e) => updateFormData('security_systems.alarms.sensors', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Compliance Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Last Audit Date
                </label>
                <input
                  type="date"
                  value={formData.compliance.lastAudit}
                  onChange={(e) => updateFormData('compliance.lastAudit', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Next Audit Date
                </label>
                <input
                  type="date"
                  value={formData.compliance.nextAudit}
                  onChange={(e) => updateFormData('compliance.nextAudit', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Compliance Score (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.compliance.score}
                  onChange={(e) => updateFormData('compliance.score', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Mitigations */}
          <div>
            <MitigationSelector
              category="asset"
              selectedMitigations={mitigations}
              onMitigationsChange={setMitigations}
              disabled={loading}
            />
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || aiScoring}
              className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading || aiScoring ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{aiScoring ? 'Calculating AI Risk Score...' : 'Adding...'}</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Add Asset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAssetForm;

export default AddAssetForm